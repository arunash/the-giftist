import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

const contributionSchema = z.object({
  itemId: z.string(),
  amount: z.number().positive(),
  message: z.string().optional().nullable(),
  isAnonymous: z.boolean().optional().default(false),
})

// POST create a contribution
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

    // In production, you would:
    // 1. Create a Stripe PaymentIntent
    // 2. Return the client secret for frontend to complete payment
    // 3. Use webhooks to confirm payment and create contribution

    // For now, simulate successful payment
    const contribution = await prisma.contribution.create({
      data: {
        itemId: data.itemId,
        contributorId: data.isAnonymous ? null : contributorId,
        amount: data.amount,
        message: data.message,
        isAnonymous: data.isAnonymous,
        status: 'COMPLETED',
        stripePaymentId: `sim_${Date.now()}`, // Simulated
      },
    })

    // Update item's funded amount
    const newFundedAmount = item.fundedAmount + data.amount
    const isFullyFunded = newFundedAmount >= goalAmount

    await prisma.item.update({
      where: { id: data.itemId },
      data: {
        fundedAmount: newFundedAmount,
        // Don't auto-mark as purchased, let owner do that
      },
    })

    // Emit activity events (fire-and-forget)
    if (contributorId) {
      createActivity({
        userId: contributorId,
        type: 'ITEM_FUNDED',
        visibility: 'PUBLIC',
        itemId: data.itemId,
        metadata: { amount: data.amount, itemName: item.name },
      }).catch(() => {})
    }

    // Notify item owner
    createActivity({
      userId: item.userId,
      type: 'CONTRIBUTION_RECEIVED',
      visibility: 'PRIVATE',
      itemId: data.itemId,
      metadata: { amount: data.amount, contributorName: data.isAnonymous ? 'Anonymous' : 'Someone' },
    }).catch(() => {})

    return NextResponse.json({
      contribution,
      newFundedAmount,
      isFullyFunded,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating contribution:', error)
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
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    )
  }
}
