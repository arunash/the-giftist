import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logApiCall, logError } from '@/lib/api-logger'
import { z } from 'zod'

const contributionSchema = z.object({
  itemId: z.string(),
  amount: z.number().positive(),
  message: z.string().optional().nullable(),
  isAnonymous: z.boolean().optional().default(false),
  returnUrl: z.string().optional(),
})

// POST create a contribution via Stripe Checkout
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const contributorId = (session?.user as any)?.id || null

    const body = await request.json()
    const data = contributionSchema.parse(body)

    // Verify item exists
    const item = await prisma.item.findUnique({
      where: { id: data.itemId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if item is already fully funded or purchased
    if (item.isPurchased) {
      return NextResponse.json(
        { error: 'This item has already been purchased' },
        { status: 400 }
      )
    }

    const goalAmount = item.goalAmount || item.priceValue || 0
    const remaining = goalAmount - item.fundedAmount

    if (data.amount > remaining && remaining > 0) {
      return NextResponse.json(
        { error: `Maximum contribution is $${remaining.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Create a PENDING contribution
    const contribution = await prisma.contribution.create({
      data: {
        itemId: data.itemId,
        contributorId: data.isAnonymous ? null : contributorId,
        amount: data.amount,
        message: data.message,
        isAnonymous: data.isAnonymous,
        status: 'PENDING',
      },
    })

    // Create Stripe Checkout Session
    const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
    const returnPath = data.returnUrl || '/'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Contribution: ${item.name}`,
              description: data.message || `Gift contribution for ${item.name}`,
            },
            unit_amount: Math.round(data.amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'contribution',
        contributionId: contribution.id,
        itemId: data.itemId,
      },
      success_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}contribute=success`,
      cancel_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}contribute=cancelled`,
    })

    logApiCall({
      provider: 'STRIPE',
      endpoint: '/checkout/sessions',
      userId: contributorId,
      source: 'WEB',
      amount: data.amount,
    }).catch(() => {})

    return NextResponse.json({ url: checkoutSession.url }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating contribution:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to create contribution' },
      { status: 500 }
    )
  }
}

// GET contributions for an item (for item owner)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId is required' },
        { status: 400 }
      )
    }

    // Verify item ownership
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const contributions = await prisma.contribution.findMany({
      where: { itemId },
      include: {
        contributor: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(contributions)
  } catch (error) {
    console.error('Error fetching contributions:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    )
  }
}
