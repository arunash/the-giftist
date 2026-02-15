import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/api-logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)

    const filter = searchParams.get('filter') || 'all' // all, unfunded, funded, purchased
    const category = searchParams.get('category') || ''
    const sort = searchParams.get('sort') || 'newest' // newest, oldest, price-high, price-low
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50)
    const eventId = searchParams.get('eventId')

    // Build where clause
    const where: any = { userId }

    // Filter by event
    if (eventId) {
      where.events = { some: { eventId } }
    }
    if (filter === 'unfunded') {
      where.fundedAmount = 0
      where.isPurchased = false
    } else if (filter === 'funded') {
      where.fundedAmount = { gt: 0 }
      where.isPurchased = false
    } else if (filter === 'purchased') {
      where.isPurchased = true
    }
    if (category) {
      where.category = category
    }
    if (cursor) {
      where.addedAt = { lt: new Date(cursor) }
    }

    // Build orderBy
    let orderBy: any = { addedAt: 'desc' }
    if (sort === 'oldest') orderBy = { addedAt: 'asc' }
    else if (sort === 'price-high') orderBy = { priceValue: 'desc' }
    else if (sort === 'price-low') orderBy = { priceValue: 'asc' }

    const items = await prisma.item.findMany({
      where,
      orderBy,
      take: limit + 1,
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'asc' },
          take: 2,
        },
      },
    })

    const hasMore = items.length > limit
    const result = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? result[result.length - 1].addedAt.toISOString() : null

    // Get categories for filter
    const categories = await prisma.item.findMany({
      where: { userId, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    })

    return NextResponse.json({
      items: result,
      nextCursor,
      categories: categories.map((c) => c.category).filter(Boolean),
    })
  } catch (error) {
    console.error('Error fetching feed:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
