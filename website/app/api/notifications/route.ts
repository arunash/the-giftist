import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const unreadOnly = searchParams.get('unread') === 'true'

  const where: any = { userId }
  if (unreadOnly) where.read = false
  if (cursor) where.createdAt = { lt: new Date(cursor) }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
  ])

  const hasMore = notifications.length > limit
  const items = hasMore ? notifications.slice(0, limit) : notifications
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null

  return NextResponse.json({
    notifications: items,
    nextCursor,
    unreadCount,
  })
}
