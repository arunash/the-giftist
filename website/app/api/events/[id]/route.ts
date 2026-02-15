import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['BIRTHDAY', 'ANNIVERSARY', 'WEDDING', 'BABY_SHOWER', 'CHRISTMAS', 'HOLIDAY', 'OTHER']).optional(),
  date: z.string().transform((val) => new Date(val)).optional(),
  description: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
  itemIds: z.array(z.string()).optional(),
})

// GET single event (public or owned)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    const { id } = params

    // First try by shareUrl (for public access)
    let event = await prisma.event.findUnique({
      where: { shareUrl: id },
      include: {
        user: {
          select: { name: true },
        },
        items: {
          include: {
            item: {
              include: {
                contributions: {
                  include: {
                    contributor: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    })

    // If not found by shareUrl, try by ID (for owner)
    if (!event) {
      event = await prisma.event.findUnique({
        where: { id },
        include: {
          user: {
            select: { name: true },
          },
          items: {
            include: {
              item: {
                include: {
                  contributions: {
                    include: {
                      contributor: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { priority: 'asc' },
          },
        },
      })
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check access: public events are accessible to all, private only to owner
    if (!event.isPublic && event.userId !== userId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

// PATCH update event
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
    const existingEvent = await prisma.event.findFirst({
      where: { id, userId },
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // If itemIds provided, update the event items
    if (data.itemIds !== undefined) {
      // Delete existing items
      await prisma.eventItem.deleteMany({
        where: { eventId: id },
      })

      // Create new items
      await prisma.eventItem.createMany({
        data: data.itemIds.map((itemId, index) => ({
          eventId: id,
          itemId,
          priority: index,
        })),
      })
    }

    const { itemIds, ...updateData } = data

    const event = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            item: true,
          },
          orderBy: { priority: 'asc' },
        },
      },
    })

    return NextResponse.json(event)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating event:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

// DELETE event
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
    const existingEvent = await prisma.event.findFirst({
      where: { id, userId },
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    await prisma.event.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
