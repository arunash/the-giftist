import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    newUsersToday,
    newUsersWeek,
    usersWithPhone,
    usersWithEmail,
    usersWithBoth,
    activeUsers,
    goldUsers,
    totalItems,
    itemsToday,
    itemsWeek,
    itemsBySource,
    itemsBySourceAllTime,
    waMessagesToday,
    waMessagesWeek,
    waMessagesFailed,
    waMessagesTotal,
    waByStatus,
    waByType,
    platformFees,
    platformFeesToday,
    contributionsTotal,
    contributionsToday,
    contributionCount,
    contributionCountToday,
    activeSubscriptions,
    totalSubscriptionRevenue,
    costsByProvider,
    costsToday,
    errorsBySource,
    errorsToday,
    recentErrors,
    recentUsers,
    recentActivity,
    itemsAddedToday,
    totalEvents,
    totalCircleMembers,
    totalChatMessages,
    chatMessagesToday,
    eventsToday,
    eventsWeek,
    circleMembersToday,
    circleMembersWeek,
    chatMessagesWeek,
    chatByRole,
    uniqueChatUsersToday,
    waOutboundToday,
    waOutboundTotal,
    waUniquePhonesToday,
    itemsBySourceWeek,
    errorsWeek,
    errorsBySourceToday,
    feedbackPositive,
    feedbackNegative,
    recentFeedback,
    totalClicks,
    totalLinks,
    topClicked,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { phone: { not: null } } }),
    prisma.user.count({ where: { email: { not: null } } }),
    prisma.user.count({ where: { phone: { not: null }, email: { not: null } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.item.count({ where: { source: { not: 'SEED' } } }),
    prisma.item.count({ where: { addedAt: { gte: todayStart }, source: { not: 'SEED' } } }),
    prisma.item.count({ where: { addedAt: { gte: weekAgo }, source: { not: 'SEED' } } }),
    prisma.item.groupBy({
      by: ['source'],
      _count: { id: true },
      where: { addedAt: { gte: todayStart }, source: { not: 'SEED' } },
    }),
    prisma.item.groupBy({
      by: ['source'],
      _count: { id: true },
      where: { source: { not: 'SEED' } },
    }),
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: todayStart }, phone: { not: '15550000000' } } }),
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: weekAgo }, phone: { not: '15550000000' } } }),
    prisma.whatsAppMessage.count({ where: { status: 'FAILED', phone: { not: '15550000000' } } }),
    prisma.whatsAppMessage.count({ where: { phone: { not: '15550000000' } } }),
    prisma.whatsAppMessage.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.whatsAppMessage.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.contribution.aggregate({
      _sum: { platformFeeAmount: true },
      where: { status: 'COMPLETED' },
    }),
    prisma.contribution.aggregate({
      _sum: { platformFeeAmount: true },
      where: { status: 'COMPLETED', createdAt: { gte: todayStart } },
    }),
    prisma.contribution.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED' },
    }),
    prisma.contribution.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED', createdAt: { gte: todayStart } },
    }),
    prisma.contribution.count({ where: { status: 'COMPLETED' } }),
    prisma.contribution.count({ where: { status: 'COMPLETED', createdAt: { gte: todayStart } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.aggregate({
      _count: { id: true },
      where: { status: 'ACTIVE' },
    }),
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
    prisma.errorLog.groupBy({
      by: ['source'],
      _count: { id: true },
    }),
    prisma.errorLog.count({ where: { createdAt: { gte: todayStart } } }),
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
        _count: { select: { items: { where: { source: { not: 'SEED' } } } } },
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
      where: { addedAt: { gte: todayStart }, source: { not: 'SEED' } },
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
    prisma.event.count(),
    prisma.circleMember.count(),
    prisma.chatMessage.count(),
    prisma.chatMessage.count({ where: { createdAt: { gte: todayStart } } }),
    // Engagement breakdowns
    prisma.event.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.event.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.circleMember.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.circleMember.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.chatMessage.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.chatMessage.groupBy({ by: ['role'], _count: { id: true }, where: { createdAt: { gte: todayStart } } }),
    prisma.chatMessage.groupBy({ by: ['userId'], where: { createdAt: { gte: todayStart } } }),
    // WA outbound counts
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: todayStart }, type: { startsWith: 'OUTBOUND' } } }),
    prisma.whatsAppMessage.count({ where: { type: { startsWith: 'OUTBOUND' } } }),
    prisma.whatsAppMessage.groupBy({ by: ['phone'], where: { createdAt: { gte: todayStart } } }),
    // Items breakdown by source (week)
    prisma.item.groupBy({ by: ['source'], _count: { id: true }, where: { addedAt: { gte: weekAgo }, source: { not: 'SEED' } } }),
    // Errors
    prisma.errorLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.errorLog.groupBy({ by: ['source'], _count: { id: true }, where: { createdAt: { gte: todayStart } } }),
    // Feedback
    prisma.feedback.count({ where: { rating: 'positive' } }),
    prisma.feedback.count({ where: { rating: 'negative' } }),
    prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { name: true, phone: true } } } }),
    // Product clicks
    prisma.productClick.aggregate({ _sum: { clicks: true } }),
    prisma.productClick.count(),
    prisma.productClick.findMany({ where: { clicks: { gt: 0 } }, orderBy: { clicks: 'desc' }, take: 10, select: { productName: true, clicks: true, source: true, targetUrl: true } }),
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

  // Build source breakdowns
  const sourceBreakdown: Record<string, number> = {}
  for (const s of itemsBySource) {
    sourceBreakdown[s.source] = s._count.id
  }
  const sourceBreakdownAll: Record<string, number> = {}
  for (const s of itemsBySourceAllTime) {
    sourceBreakdownAll[s.source] = s._count.id
  }

  // WA breakdowns
  const waStatusBreakdown: Record<string, number> = {}
  for (const s of waByStatus) {
    waStatusBreakdown[s.status] = s._count.id
  }
  const waTypeBreakdown: Record<string, number> = {}
  for (const s of waByType) {
    waTypeBreakdown[s.type] = s._count.id
  }

  // Error breakdowns
  const errorSourceBreakdown: Record<string, number> = {}
  for (const e of errorsBySource) {
    errorSourceBreakdown[e.source] = e._count.id
  }

  // Chat role breakdown
  const chatRoleBreakdown: Record<string, number> = {}
  for (const r of chatByRole) {
    chatRoleBreakdown[r.role] = r._count.id
  }

  // Source breakdown for week
  const sourceBreakdownWeek: Record<string, number> = {}
  for (const s of itemsBySourceWeek) {
    sourceBreakdownWeek[s.source] = s._count.id
  }

  // Avg items per user
  const avgItemsPerUser = totalUsers > 0 ? Math.round((totalItems / totalUsers) * 10) / 10 : 0

  // Error source breakdown (today only)
  const errorSourceBreakdownToday: Record<string, number> = {}
  for (const e of errorsBySourceToday) {
    errorSourceBreakdownToday[e.source] = e._count.id
  }

  const totalCosts = Object.values(costsMap).reduce((sum, c) => sum + c.total, 0)
  const todayCosts = Object.values(costsMap).reduce((sum, c) => sum + c.today, 0)

  return NextResponse.json({
    users: {
      total: totalUsers,
      newToday: newUsersToday,
      newWeek: newUsersWeek,
      withPhone: usersWithPhone,
      withEmail: usersWithEmail,
      withBoth: usersWithBoth,
      active: activeUsers,
      gold: goldUsers,
    },
    items: {
      total: totalItems,
      today: itemsToday,
      week: itemsWeek,
      sourceBreakdown,
      sourceBreakdownAll,
      sourceBreakdownWeek,
      avgPerUser: avgItemsPerUser,
    },
    whatsapp: {
      total: waMessagesTotal,
      today: waMessagesToday,
      week: waMessagesWeek,
      failed: waMessagesFailed,
      statusBreakdown: waStatusBreakdown,
      typeBreakdown: waTypeBreakdown,
      outboundToday: waOutboundToday,
      outboundTotal: waOutboundTotal,
      uniquePhonesToday: waUniquePhonesToday.length,
    },
    revenue: {
      platformFees: platformFees._sum.platformFeeAmount || 0,
      platformFeesToday: platformFeesToday._sum.platformFeeAmount || 0,
      contributions: contributionsTotal._sum.amount || 0,
      contributionsToday: contributionsToday._sum.amount || 0,
      contributionCount,
      contributionCountToday,
      avgContribution: contributionCount > 0 ? (contributionsTotal._sum.amount || 0) / contributionCount : 0,
      activeSubscriptions,
    },
    engagement: {
      totalEvents,
      eventsToday,
      eventsWeek,
      totalCircleMembers,
      circleMembersToday,
      circleMembersWeek,
      totalChatMessages,
      chatMessagesToday,
      chatMessagesWeek,
      chatByRole: chatRoleBreakdown,
      uniqueChatUsersToday: uniqueChatUsersToday.length,
    },
    costs: costsMap,
    costsTotalAll: totalCosts,
    costsTotalToday: todayCosts,
    errors: {
      today: errorsToday,
      week: errorsWeek,
      bySource: errorSourceBreakdown,
      bySourceToday: errorSourceBreakdownToday,
    },
    recentErrors,
    recentUsers,
    recentActivity,
    itemsAddedToday,
    feedback: {
      positive: feedbackPositive,
      negative: feedbackNegative,
      recent: recentFeedback,
    },
    productClicks: {
      totalClicks: totalClicks._sum.clicks || 0,
      totalLinks,
      topClicked,
    },
  })
}
