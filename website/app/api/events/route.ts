import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { notifyEventCreated, smartWhatsAppSend } from '@/lib/notifications'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const eventSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['BIRTHDAY', 'ANNIVERSARY', 'WEDDING', 'BABY_SHOWER', 'CHRISTMAS', 'HOLIDAY', 'OTHER']),
  date: z.string().transform((val) => new Date(val)),
  description: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(true),
  itemIds: z.array(z.string()).optional().default([]),
})

// Compute the next future occurrence of a month/day
function getNextOccurrence(date: Date): Date {
  const now = new Date()
  const thisYear = new Date(now.getFullYear(), date.getMonth(), date.getDate())
  if (thisYear > now) return thisYear
  return new Date(now.getFullYear() + 1, date.getMonth(), date.getDate())
}

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

    // Auto-advance past events to next year (all events repeat annually)
    const now = new Date()
    const advancePromises = events
      .filter((e) => new Date(e.date) < now)
      .map((e) => {
        const nextDate = getNextOccurrence(new Date(e.date))
        e.date = nextDate
        return prisma.event.update({
          where: { id: e.id },
          data: { date: nextDate },
        })
      })

    if (advancePromises.length > 0) {
      await Promise.all(advancePromises)
    }

    // Re-sort after date changes
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
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

    // Dedup: if an event with the same name already exists for this user, return it
    const existing = await prisma.event.findFirst({
      where: { userId, name: data.name },
      include: { items: { include: { item: true } } },
    })
    if (existing) {
      return NextResponse.json(existing, { status: 200 })
    }

    // Check event creation limits: 1 free event, then need Event Pass or Gold
    const FREE_EVENT_LIMIT = 1
    const [subscription, existingEventCount, unusedPurchases] = await Promise.all([
      prisma.subscription.findUnique({
        where: { userId },
        select: { status: true, currentPeriodEnd: true },
      }),
      prisma.event.count({ where: { userId } }),
      prisma.eventPurchase.count({
        where: { userId, status: 'COMPLETED', eventId: null },
      }),
    ])

    const isGold = subscription?.status === 'ACTIVE' &&
      (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date())

    if (!isGold && existingEventCount >= FREE_EVENT_LIMIT && unusedPurchases <= 0) {
      return NextResponse.json(
        {
          error: 'event_limit',
          message: 'Purchase an Event Pass ($2.99) to create more events, or upgrade to Gold for unlimited events.',
        },
        { status: 403 }
      )
    }

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

    // Link to unused event purchase if applicable
    if (!isGold && existingEventCount >= FREE_EVENT_LIMIT && unusedPurchases > 0) {
      const unusedPurchase = await prisma.eventPurchase.findFirst({
        where: { userId, status: 'COMPLETED', eventId: null },
      })
      if (unusedPurchase) {
        await prisma.eventPurchase.update({
          where: { id: unusedPurchase.id },
          data: { eventId: event.id },
        })
      }
    }

    // Emit activity event
    createActivity({
      userId,
      type: 'EVENT_CREATED',
      visibility: 'PUBLIC',
      metadata: { eventName: event.name, eventType: event.type },
    }).catch(() => {})

    // In-app notification
    notifyEventCreated(userId, event.name, event.id).catch(() => {})

    // Milestone: first event created
    const eventCount = await prisma.event.count({ where: { userId } })
    if (eventCount === 1) {
      const milestoneUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      })
      if (milestoneUser?.phone) {
        smartWhatsAppSend(
          milestoneUser.phone,
          `Your first event is set! Add gift ideas so your circle knows what to get: ${event.name}`,
          'milestone_first_event',
          [event.name]
        ).catch(() => {})
      }
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      )
    }
    console.error('Error creating event:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
