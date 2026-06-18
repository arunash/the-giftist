import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  isPublic: z.boolean().optional().default(true),
  eventId: z.string().optional().nullable(),
})

// GET — list the authenticated user's gift lists, with item counts + cover images
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const lists = await prisma.giftList.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: {
          orderBy: { priority: 'asc' },
          include: { item: { select: { id: true, image: true } } },
        },
      },
    })

    const shaped = lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      shareUrl: l.shareUrl,
      isPublic: l.isPublic,
      eventId: l.eventId,
      updatedAt: l.updatedAt,
      itemCount: l.items.length,
      coverImages: l.items
        .map((li) => li.item?.image)
        .filter((img): img is string => Boolean(img))
        .slice(0, 4),
    }))

    return NextResponse.json(shaped)
  } catch (error) {
    console.error('Error listing gift lists:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to list gift lists' }, { status: 500 })
  }
}

// POST — create a new gift list (dedups by name for the user)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const data = createSchema.parse(body)

    // Dedup: return the existing list if one with the same name exists
    const existing = await prisma.giftList.findFirst({
      where: { userId, name: data.name },
    })
    if (existing) {
      return NextResponse.json(existing, { status: 200 })
    }

    const list = await prisma.giftList.create({
      data: {
        userId,
        name: data.name,
        description: data.description ?? null,
        isPublic: data.isPublic,
        eventId: data.eventId ?? null,
      },
    })

    return NextResponse.json(list, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    console.error('Error creating gift list:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to create gift list' }, { status: 500 })
  }
}
