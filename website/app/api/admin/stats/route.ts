import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    totalUsers,
    newUsersToday,
    totalItems,
    itemsToday,
    itemsBySource,
    waMessagesToday,
    waMessagesFailed,
    waMessagesTotal,
    platformFees,
    contributionsTotal,
    activeSubscriptions,
    costsByProvider,
    costsToday,
    recentErrors,
    recentUsers,
    recentActivity,
    itemsAddedToday,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.item.count(),
    prisma.item.count({ where: { addedAt: { gte: todayStart } } }),
    prisma.item.groupBy({
      by: ['source'],
      _count: { id: true },
      where: { addedAt: { gte: todayStart } },
    }),
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.whatsAppMessage.count({ where: { status: 'FAILED' } }),
    prisma.whatsAppMessage.count(),
    prisma.contribution.aggregate({
      _sum: { platformFeeAmount: true },
      where: { status: 'COMPLETED' },
    }),
    prisma.contribution.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED' },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.apiCallLog.groupBy({
      by: ['provider'],
      _sum: { estimatedCost: true },
      _count: { id: true },
    }),
    prisma.apiCallLog.groupBy({
      by: ['provider'],
      _sum: { estimatedCost: true },
      _count: { id: true },
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.activityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { name: true } },
        item: { select: { name: true } },
      },
    }),
    prisma.item.findMany({
      where: { addedAt: { gte: todayStart } },
      orderBy: { addedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        source: true,
        priceValue: true,
        price: true,
        addedAt: true,
        user: { select: { name: true } },
      },
    }),
  ])

  // Build costs map
  const costsMap: Record<string, { total: number; today: number; count: number; countToday: number }> = {}
  for (const c of costsByProvider) {
    costsMap[c.provider] = {
      total: c._sum.estimatedCost || 0,
      today: 0,
      count: c._count.id,
      countToday: 0,
    }
  }
  for (const c of costsToday) {
    if (!costsMap[c.provider]) {
      costsMap[c.provider] = { total: 0, today: 0, count: 0, countToday: 0 }
    }
    costsMap[c.provider].today = c._sum.estimatedCost || 0
    costsMap[c.provider].countToday = c._count.id
  }

  // Build source breakdown
  const sourceBreakdown: Record<string, number> = {}
  for (const s of itemsBySource) {
    sourceBreakdown[s.source] = s._count.id
  }

  return NextResponse.json({
    users: {
      total: totalUsers,
      newToday: newUsersToday,
    },
    items: {
      total: totalItems,
      today: itemsToday,
      sourceBreakdown,
    },
    whatsapp: {
      total: waMessagesTotal,
      today: waMessagesToday,
      failed: waMessagesFailed,
    },
    revenue: {
      platformFees: platformFees._sum.platformFeeAmount || 0,
      contributions: contributionsTotal._sum.amount || 0,
      activeSubscriptions,
    },
    costs: costsMap,
    recentErrors,
    recentUsers,
    recentActivity,
    itemsAddedToday,
  })
}
