import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const addSchema = z.object({
  itemId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
})

// POST — add an item to a list (owner only). Idempotent on (listId, itemId).
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
    const { id: listId } = params
    const body = await request.json()
    const data = addSchema.parse(body)

    // Verify the list belongs to the user
    const list = await prisma.giftList.findFirst({ where: { id: listId, userId } })
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Verify the item exists (any item can be saved; ownership not required to reference)
    const item = await prisma.item.findUnique({ where: { id: data.itemId }, select: { id: true } })
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const count = await prisma.giftListItem.count({ where: { listId } })

    const listItem = await prisma.giftListItem.upsert({
      where: { listId_itemId: { listId, itemId: data.itemId } },
      update: { note: data.note ?? undefined },
      create: {
        listId,
        itemId: data.itemId,
        addedById: userId,
        note: data.note ?? null,
        priority: count,
      },
    })

    // Touch the list so it sorts to the top of "recently updated"
    await prisma.giftList.update({ where: { id: listId }, data: { updatedAt: new Date() } })

    return NextResponse.json(listItem, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    console.error('Error adding item to list:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to add item to list' }, { status: 500 })
  }
}

// DELETE — remove an item from a list (owner only). Pass ?itemId=...
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
    const { id: listId } = params
    const itemId = request.nextUrl.searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    const list = await prisma.giftList.findFirst({ where: { id: listId, userId } })
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    await prisma.giftListItem.deleteMany({ where: { listId, itemId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing item from list:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to remove item from list' }, { status: 500 })
  }
}
