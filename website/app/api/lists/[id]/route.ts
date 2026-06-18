import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  isPublic: z.boolean().optional(),
})

// GET — a single list with its items (owner only)
export async function GET(
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

    const list = await prisma.giftList.findFirst({
      where: { id, userId },
      include: {
        items: {
          orderBy: { priority: 'asc' },
          include: {
            item: {
              include: {
                eventItems: { include: { event: true } },
              },
            },
          },
        },
      },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    return NextResponse.json(list)
  } catch (error) {
    console.error('Error fetching gift list:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to fetch gift list' }, { status: 500 })
  }
}

// PATCH — update list metadata (owner only)
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

    const existing = await prisma.giftList.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const list = await prisma.giftList.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        description: data.description === undefined ? undefined : data.description,
        isPublic: data.isPublic ?? undefined,
      },
    })

    return NextResponse.json(list)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    console.error('Error updating gift list:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to update gift list' }, { status: 500 })
  }
}

// DELETE — remove a list (owner only); GiftListItems cascade
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

    const existing = await prisma.giftList.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    await prisma.giftList.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting gift list:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to delete gift list' }, { status: 500 })
  }
}
