import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { sendTemplateMessage } from '@/lib/whatsapp'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const updateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  price: z.string().optional().nullable(),
  priceValue: z.number().optional().nullable(),
  image: z.string().url().optional().nullable(),
  category: z.string().optional().nullable(),
  isPurchased: z.boolean().optional(),
  eventId: z.string().optional().nullable(),
})

// GET single item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    const item = await prisma.item.findFirst({
      where: { id },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'asc' },
        },
        contributions: {
          include: {
            contributor: {
              select: { name: true },
            },
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching item:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

// PATCH update item
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id } = params
    const body = await request.json()
    const data = updateSchema.parse(body)

    // Verify ownership
    const existingItem = await prisma.item.findFirst({
      where: { id, userId },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // If price changed, add to history
    const priceHistoryCreate =
      data.priceValue && data.priceValue !== existingItem.priceValue
        ? {
            create: {
              price: data.priceValue,
            },
          }
        : undefined

    // Handle event mapping
    const { eventId, ...updateData } = data
    if (eventId !== undefined) {
      // Remove existing event mappings for this item
      await prisma.eventItem.deleteMany({ where: { itemId: id } })
      // Add new mapping if eventId is provided
      if (eventId) {
        await prisma.eventItem.create({
          data: { eventId, itemId: id, priority: 0 },
        })
        // Emit activity for item added to event
        const event = await prisma.event.findUnique({ where: { id: eventId }, select: { name: true } })
        createActivity({
          userId,
          type: 'EVENT_ITEM_ADDED',
          visibility: 'PUBLIC',
          itemId: id,
          metadata: { itemName: existingItem.name, eventName: event?.name || '' },
        }).catch(() => {})
      }
    }

    const item = await prisma.item.update({
      where: { id },
      data: {
        ...updateData,
        purchasedAt: data.isPurchased ? new Date() : undefined,
        priceHistory: priceHistoryCreate,
      },
      include: {
        priceHistory: true,
      },
    })

    // Emit activity + notify contributors if marked as purchased
    if (data.isPurchased && !existingItem.isPurchased) {
      createActivity({
        userId,
        type: 'ITEM_PURCHASED',
        visibility: 'PUBLIC',
        itemId: id,
        metadata: { itemName: item.name },
      }).catch(() => {})

      // Notify all contributors via WhatsApp (template: item_purchased)
      // Body: "Great news! "{{1}}" has been marked for purchase on Giftist. Thank you for contributing toward this gift — your generosity made it happen!"
      const contributions = await prisma.contribution.findMany({
        where: { itemId: id, status: 'COMPLETED' },
        include: { contributor: { select: { phone: true, name: true } } },
      })
      for (const c of contributions) {
        if (c.contributor?.phone) {
          sendTemplateMessage(
            c.contributor.phone,
            'item_purchased',
            [item.name]
          ).catch((err) => console.error('Purchase notification failed:', err))
        }
      }
    }

    return NextResponse.json(item)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      )
    }
    console.error('Error updating item:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id } = params

    // Verify ownership
    const existingItem = await prisma.item.findFirst({
      where: { id, userId },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await prisma.item.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting item:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
