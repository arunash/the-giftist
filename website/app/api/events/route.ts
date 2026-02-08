import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const eventSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['BIRTHDAY', 'ANNIVERSARY', 'WEDDING', 'BABY_SHOWER', 'CHRISTMAS', 'HOLIDAY', 'OTHER']),
  date: z.string().transform((val) => new Date(val)),
  description: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(true),
  itemIds: z.array(z.string()).optional().default([]),
})

// GET all events for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const events = await prisma.event.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      include: {
        items: {
          include: {
            item: {
              include: {
                contributions: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST create a new event
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const data = eventSchema.parse(body)

    const event = await prisma.event.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        date: data.date,
        description: data.description,
        isPublic: data.isPublic,
        items: {
          create: data.itemIds.map((itemId, index) => ({
            itemId,
            priority: index,
          })),
        },
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
