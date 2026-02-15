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
    const tab = searchParams.get('tab') || 'mine'
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const where = tab === 'community'
      ? { visibility: 'PUBLIC' }
      : { userId }

    const activities = await prisma.activityEvent.findMany({
      where: {
        ...where,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        user: { select: { name: true, image: true } },
        item: { select: { name: true, image: true, price: true, priceValue: true, url: true, domain: true, fundedAmount: true, goalAmount: true } },
      },
    })

    const hasMore = activities.length > limit
    const items = hasMore ? activities.slice(0, limit) : activities
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null

    return NextResponse.json({ items, nextCursor })
  } catch (error) {
    console.error('Error fetching activity:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
