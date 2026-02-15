import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { logError } from '@/lib/api-logger'
import { z } from 'zod'

const allocateSchema = z.object({
  itemId: z.string(),
  amount: z.number().positive(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const eventId = params.id
    const body = await request.json()
    const data = allocateSchema.parse(body)

    // Validate event ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, userId },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (data.amount > event.fundedAmount) {
      return NextResponse.json(
        { error: `Only $${event.fundedAmount.toFixed(2)} available to allocate` },
        { status: 400 }
      )
    }

    // Validate item belongs to user and is in the event
    const item = await prisma.item.findFirst({
      where: { id: data.itemId, userId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Transfer funds: decrement event, increment item
    await prisma.$transaction([
      prisma.event.update({
        where: { id: eventId },
        data: { fundedAmount: { decrement: data.amount } },
      }),
      prisma.item.update({
        where: { id: data.itemId },
        data: { fundedAmount: { increment: data.amount } },
      }),
    ])

    await createActivity({
      userId,
      type: 'FUNDS_ALLOCATED',
      visibility: 'PRIVATE',
      itemId: data.itemId,
      metadata: {
        amount: data.amount,
        eventName: event.name,
        itemName: item.name,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Error allocating funds:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to allocate funds' }, { status: 500 })
  }
}
