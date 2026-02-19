import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logApiCall, logError } from '@/lib/api-logger'
import { z } from 'zod'

const contributionSchema = z.object({
  itemId: z.string().optional(),
  eventId: z.string().optional(),
  amount: z.number().positive().min(1, 'Minimum contribution is $1.00'),
  message: z.string().max(500).optional().nullable(),
  isAnonymous: z.boolean().optional().default(false),
  contributorEmail: z.string().email().optional().nullable(),
  returnUrl: z.string().optional(),
  paymentMethod: z.enum(['STRIPE', 'VENMO', 'PAYPAL']).default('STRIPE'),
}).refine(data => data.itemId || data.eventId, {
  message: 'Either itemId or eventId is required',
})

// POST create a contribution via Stripe Checkout or Braintree
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const contributorId = (session?.user as any)?.id || null

    const body = await request.json()
    const data = contributionSchema.parse(body)

    let productName: string
    let productDescription: string

    if (data.itemId) {
      // Item-level contribution
      const item = await prisma.item.findUnique({
        where: { id: data.itemId },
      })

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }

      if (item.isPurchased) {
        return NextResponse.json(
          { error: 'This item has already been purchased' },
          { status: 400 }
        )
      }

      const goalAmount = item.goalAmount || item.priceValue || 0
      const remaining = goalAmount > 0 ? goalAmount - item.fundedAmount : Infinity

      if (remaining <= 0) {
        return NextResponse.json(
          { error: 'This item is already fully funded' },
          { status: 400 }
        )
      }

      if (data.amount > remaining && remaining !== Infinity) {
        return NextResponse.json(
          { error: `Maximum contribution is $${remaining.toFixed(2)}` },
          { status: 400 }
        )
      }

      productName = `Contribution: ${item.name}`
      productDescription = data.message || `Gift contribution for ${item.name}`
    } else {
      // Event-level contribution
      const event = await prisma.event.findUnique({
        where: { id: data.eventId! },
      })

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      productName = `Contribution: ${event.name}`
      productDescription = data.message || `Gift fund contribution for ${event.name}`
    }

    // Use contributor's chosen payment method
    const paymentProvider = data.paymentMethod

    // Create a PENDING contribution
    const contribution = await prisma.contribution.create({
      data: {
        itemId: data.itemId || null,
        eventId: data.eventId || null,
        contributorId: data.isAnonymous ? null : contributorId,
        contributorEmail: data.contributorEmail || null,
        amount: data.amount,
        message: data.message,
        isAnonymous: data.isAnonymous,
        paymentProvider,
        status: 'PENDING',
      },
    })

    // For Venmo/PayPal: return Braintree client token so frontend handles inline payment
    if (paymentProvider === 'VENMO' || paymentProvider === 'PAYPAL') {
      const { gateway } = await import('@/lib/braintree')
      const tokenResponse = await gateway.clientToken.generate({})

      logApiCall({
        provider: 'BRAINTREE',
        endpoint: '/client_token/generate',
        userId: contributorId,
        source: 'WEB',
        amount: data.amount,
      }).catch(() => {})

      return NextResponse.json({
        provider: 'BRAINTREE',
        paymentProvider,
        clientToken: tokenResponse.clientToken,
        contributionId: contribution.id,
      }, { status: 200 })
    }

    // For Stripe: create Checkout Session (existing flow)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
    const returnPath = data.returnUrl || '/'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: Math.round(data.amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'contribution',
        contributionId: contribution.id,
        itemId: data.itemId || '',
        eventId: data.eventId || '',
      },
      success_url: `${baseUrl}/contribute/success?id=${contribution.id}&returnUrl=${encodeURIComponent(returnPath)}`,
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
        { error: 'Invalid data' },
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
