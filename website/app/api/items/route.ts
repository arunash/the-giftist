import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { calculateGoalAmount } from '@/lib/platform-fee'
import { logError } from '@/lib/api-logger'
import { z } from 'zod'

const httpsUrl = z.string().url().refine((url) => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch { return false }
}, 'Only HTTP(S) URLs are allowed')

const itemSchema = z.object({
  name: z.string().min(1).max(500),
  price: z.string().optional().nullable(),
  priceValue: z.number().optional().nullable(),
  image: httpsUrl.optional().nullable(),
  url: httpsUrl,
  domain: z.string().optional(),
  category: z.string().optional().nullable(),
  source: z.enum(['WHATSAPP', 'EXTENSION', 'MANUAL', 'CHAT']).optional(),
  notes: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
})

// GET all items for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const items = await prisma.item.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'asc' },
        },
      },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching items:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

// POST create a new item
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const data = itemSchema.parse(body)

    // Extract domain from URL if not provided
    const domain = data.domain || new URL(data.url).hostname

    // Calculate goal amount with platform fee
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeContributionsReceived: true },
    })
    const feeCalc = calculateGoalAmount(data.priceValue, user?.lifetimeContributionsReceived ?? 0)

    const item = await prisma.item.create({
      data: {
        userId,
        name: data.name,
        price: data.price,
        priceValue: data.priceValue,
        image: data.image,
        url: data.url,
        domain,
        category: data.category,
        source: data.source || 'MANUAL',
        notes: data.notes,
        tags: data.tags,
        goalAmount: feeCalc.goalAmount,
        priceHistory: data.priceValue
          ? {
              create: {
                price: data.priceValue,
              },
            }
          : undefined,
      },
      include: {
        priceHistory: true,
      },
    })

    // Emit activity event (fire-and-forget)
    createActivity({
      userId,
      type: 'ITEM_ADDED',
      visibility: 'PUBLIC',
      itemId: item.id,
      metadata: { itemName: item.name, source: body.source || 'MANUAL' },
    }).catch(() => {})

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      )
    }
    console.error('Error creating item:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
