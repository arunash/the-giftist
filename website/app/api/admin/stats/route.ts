import { NextResponse } from 'next/server'
import { requireAdmin, ADMIN_TEST_PHONES } from '@/lib/admin'
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
    allUsersForReengagement,
    groupsActive,
    groupsTotal,
    groupMessagesTotal,
    groupMessagesToday,
    groupProfilesCreated,
    giftSendFeesTotal,
    giftSendFeesToday,
    giftSendVolumeTotal,
    giftSendVolumeToday,
    giftSendCount,
    giftSendCountToday,
    giftSendByStatus,
    recentGiftSends,
    fulfillmentAggregates,
    fulfillmentDetails,
    // WhatsApp inbound engagement
    waInboundTotal,
    waInboundToday,
    waInboundWeek,
    waInboundUniquePhonestoday,
    latestActiveUsers,
    // Analytics
    pageViewsTotal,
    pageViewsToday,
    pageViewsWeek,
    pageViewsByPath,
    pageViewsByReferrer,
    pageViewsByUtmSource,
    pageViewsByUtmCampaign,
    uniqueSessionsToday,
    uniqueSessionsWeek,
    allProductClicks,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { phone: { not: null } } }),
    prisma.user.count({ where: { email: { not: null } } }),
    prisma.user.count({ where: { phone: { not: null }, email: { not: null } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.item.count(),
    prisma.item.count({ where: { addedAt: { gte: todayStart } } }),
    prisma.item.count({ where: { addedAt: { gte: weekAgo } } }),
    prisma.item.groupBy({
      by: ['source'],
      _count: { id: true },
      where: { addedAt: { gte: todayStart } },
    }),
    prisma.item.groupBy({
      by: ['source'],
      _count: { id: true },
    }),
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: todayStart }, phone: { notIn: ADMIN_TEST_PHONES } } }),
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: weekAgo }, phone: { notIn: ADMIN_TEST_PHONES } } }),
    prisma.whatsAppMessage.count({ where: { status: 'FAILED', phone: { notIn: ADMIN_TEST_PHONES } } }),
    prisma.whatsAppMessage.count({ where: { phone: { notIn: ADMIN_TEST_PHONES } } }),
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
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        messageCredits: true,
        _count: { select: { items: true, chatMessages: { where: { role: 'USER' } } } },
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
    prisma.item.groupBy({ by: ['source'], _count: { id: true }, where: { addedAt: { gte: weekAgo } } }),
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
    // Re-engagement: all users with their funnel state + item counts
    prisma.user.findMany({
      where: { isActive: true, digestOptOut: false },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        funnelStage: true,
        createdAt: true,
        messageCredits: true,
        _count: { select: { items: true, chatMessages: { where: { role: 'USER' } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Group monitoring
    prisma.groupChat.count({ where: { isActive: true } }),
    prisma.groupChat.count(),
    prisma.groupChatMessage.count(),
    prisma.groupChatMessage.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.circleMember.count({ where: { source: 'GROUP_CHAT' } }),
    // Gift Send revenue
    prisma.giftSend.aggregate({
      _sum: { platformFee: true },
      where: { status: { in: ['PAID', 'NOTIFIED', 'REDEEMED'] } },
    }),
    prisma.giftSend.aggregate({
      _sum: { platformFee: true },
      where: { status: { in: ['PAID', 'NOTIFIED', 'REDEEMED'] }, createdAt: { gte: todayStart } },
    }),
    prisma.giftSend.aggregate({
      _sum: { totalCharged: true },
      where: { status: { in: ['PAID', 'NOTIFIED', 'REDEEMED'] } },
    }),
    prisma.giftSend.aggregate({
      _sum: { totalCharged: true },
      where: { status: { in: ['PAID', 'NOTIFIED', 'REDEEMED'] }, createdAt: { gte: todayStart } },
    }),
    prisma.giftSend.count({
      where: { status: { in: ['PAID', 'NOTIFIED', 'REDEEMED'] } },
    }),
    prisma.giftSend.count({
      where: { status: { in: ['PAID', 'NOTIFIED', 'REDEEMED'] }, createdAt: { gte: todayStart } },
    }),
    prisma.giftSend.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.giftSend.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        itemName: true,
        amount: true,
        platformFee: true,
        totalCharged: true,
        status: true,
        recipientName: true,
        createdAt: true,
        sender: { select: { name: true } },
      },
    }),
    // Fulfillment cost totals for P&L
    prisma.giftSend.aggregate({
      _sum: { fulfillmentCost: true, amount: true, platformFee: true, totalCharged: true },
      where: { fulfillmentCost: { not: null } },
    }),
    prisma.giftSend.findMany({
      where: { status: { in: ['SHIPPED', 'DELIVERED', 'REDEEMED_PENDING_SHIPMENT'] } },
      select: {
        id: true, itemName: true, amount: true, platformFee: true, totalCharged: true,
        fulfillmentCost: true, status: true, createdAt: true,
        sender: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // WhatsApp inbound engagement
    prisma.whatsAppMessage.count({ where: { type: { in: ['text', 'document', 'image', 'contacts', 'audio', 'video'] } } }),
    prisma.whatsAppMessage.count({ where: { type: { in: ['text', 'document', 'image', 'contacts', 'audio', 'video'] }, createdAt: { gte: todayStart } } }),
    prisma.whatsAppMessage.count({ where: { type: { in: ['text', 'document', 'image', 'contacts', 'audio', 'video'] }, createdAt: { gte: weekAgo } } }),
    prisma.whatsAppMessage.groupBy({ by: ['phone'], where: { type: { in: ['text', 'document', 'image', 'contacts', 'audio', 'video'] }, createdAt: { gte: todayStart } } }),
    // Latest active users (combined web + WhatsApp)
    prisma.$queryRaw<{ id: string; name: string | null; phone: string | null; last_web: Date | null; web_msgs: bigint; last_wa: Date | null; wa_msgs: bigint }[]>`
      SELECT u.id, u.name, u.phone,
        (SELECT MAX(cm."createdAt") FROM "ChatMessage" cm WHERE cm."userId" = u.id AND cm.role = 'USER') as last_web,
        (SELECT COUNT(*) FROM "ChatMessage" cm WHERE cm."userId" = u.id AND cm.role = 'USER') as web_msgs,
        (SELECT MAX(wm."createdAt") FROM "WhatsAppMessage" wm WHERE wm.phone = u.phone AND wm.type IN ('text','document','image','contacts','audio','video')) as last_wa,
        (SELECT COUNT(*) FROM "WhatsAppMessage" wm WHERE wm.phone = u.phone AND wm.type IN ('text','document','image','contacts','audio','video')) as wa_msgs
      FROM "User" u
      WHERE u.phone IS NOT NULL
        AND u.phone NOT IN ('13034087839','14153168720','15550000000','3034087839_test','919321918293')
      ORDER BY GREATEST(
        COALESCE((SELECT MAX(cm."createdAt") FROM "ChatMessage" cm WHERE cm."userId" = u.id), u."createdAt"),
        COALESCE((SELECT MAX(wm."createdAt") FROM "WhatsAppMessage" wm WHERE wm.phone = u.phone AND wm.type IN ('text','document','image','contacts','audio','video')), u."createdAt")
      ) DESC
      LIMIT 15
    `,
    // Analytics queries
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.pageView.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.pageView.groupBy({ by: ['path'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 20 }),
    prisma.pageView.groupBy({ by: ['referrer'], _count: { id: true }, where: { referrer: { not: null } }, orderBy: { _count: { id: 'desc' } }, take: 20 }),
    prisma.pageView.groupBy({ by: ['utmSource'], _count: { id: true }, where: { utmSource: { not: null } }, orderBy: { _count: { id: 'desc' } }, take: 20 }),
    prisma.pageView.groupBy({ by: ['utmCampaign'], _count: { id: true }, where: { utmCampaign: { not: null } }, orderBy: { _count: { id: 'desc' } }, take: 20 }),
    prisma.pageView.groupBy({ by: ['sessionId'], where: { createdAt: { gte: todayStart }, sessionId: { not: null } } }),
    prisma.pageView.groupBy({ by: ['sessionId'], where: { createdAt: { gte: weekAgo }, sessionId: { not: null } } }),
    prisma.productClick.findMany({
      orderBy: { clicks: 'desc' },
      select: {
        id: true, slug: true, productName: true, targetUrl: true, price: true, priceValue: true,
        image: true, userId: true, source: true, clicks: true, lastReferrer: true,
        createdAt: true, lastClicked: true,
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

  // Build re-engagement data
  const reengagementUsers = allUsersForReengagement.map(u => {
    let funnelState: any = {}
    try { funnelState = u.funnelStage ? JSON.parse(u.funnelStage as string) : {} } catch {}
    const isUS = u.phone && u.phone.startsWith('1') && u.phone.length === 11
    const hasItems = u._count.items > 0
    const reengagementSentAt = funnelState.reengagementSent || null

    let channel: string | null = null
    let status: string
    if (hasItems) {
      status = 'activated'
    } else if (reengagementSentAt) {
      status = 'sent'
      channel = u.phone ? (isUS ? 'sms' : 'whatsapp') : 'email'
    } else if (!u.phone && !u.email) {
      status = 'no_contact'
    } else {
      status = 'eligible'
    }

    return {
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      items: u._count.items,
      status,
      channel,
      sentAt: reengagementSentAt,
      createdAt: u.createdAt,
    }
  })

  const reengagementStats = {
    smsSent: reengagementUsers.filter(u => u.status === 'sent' && u.channel === 'sms').length,
    whatsappSent: reengagementUsers.filter(u => u.status === 'sent' && u.channel === 'whatsapp').length,
    emailSent: reengagementUsers.filter(u => u.status === 'sent' && u.channel === 'email').length,
    activated: reengagementUsers.filter(u => u.status === 'activated').length,
    eligible: reengagementUsers.filter(u => u.status === 'eligible').length,
    users: reengagementUsers.filter(u => u.status !== 'activated'),
  }

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
      giftSendFees: giftSendFeesTotal._sum.platformFee || 0,
      giftSendFeesToday: giftSendFeesToday._sum.platformFee || 0,
      giftSendVolume: giftSendVolumeTotal._sum.totalCharged || 0,
      giftSendVolumeToday: giftSendVolumeToday._sum.totalCharged || 0,
      giftSendCount,
      giftSendCountToday,
      giftSendByStatus: Object.fromEntries(giftSendByStatus.map(s => [s.status, s._count.id])),
      recentGiftSends,
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
      waInboundTotal,
      waInboundToday,
      waInboundWeek,
      waInboundUniqueToday: waInboundUniquePhonestoday.length,
      latestActiveUsers: latestActiveUsers.map(u => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        lastWeb: u.last_web,
        webMsgs: Number(u.web_msgs),
        lastWa: u.last_wa,
        waMsgs: Number(u.wa_msgs),
      })),
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
    reengagement: reengagementStats,
    groupMonitoring: {
      activeGroups: groupsActive,
      totalGroups: groupsTotal,
      bufferedMessages: groupMessagesTotal,
      messagesToday: groupMessagesToday,
      profilesCreated: groupProfilesCreated,
    },
    analytics: {
      pageViews: {
        total: pageViewsTotal,
        today: pageViewsToday,
        week: pageViewsWeek,
        uniqueSessionsToday: uniqueSessionsToday.length,
        uniqueSessionsWeek: uniqueSessionsWeek.length,
      },
      topPages: (pageViewsByPath as any[]).map(p => ({ path: p.path, views: p._count.id })),
      topReferrers: (pageViewsByReferrer as any[]).map(r => ({ referrer: r.referrer, views: r._count.id })),
      topUtmSources: (pageViewsByUtmSource as any[]).map(u => ({ source: u.utmSource, views: u._count.id })),
      topUtmCampaigns: (pageViewsByUtmCampaign as any[]).map(c => ({ campaign: c.utmCampaign, views: c._count.id })),
      allProductClicks: allProductClicks as any[],
    },
    pnl: {
      totalRevenue: (fulfillmentAggregates as any)._sum?.platformFee || 0,
      totalFulfillmentCost: (fulfillmentAggregates as any)._sum?.fulfillmentCost || 0,
      totalGiftVolume: (fulfillmentAggregates as any)._sum?.amount || 0,
      // Stripe takes ~2.9% + $0.30 per transaction
      details: (fulfillmentDetails as any[]).map((g: any) => ({
        id: g.id,
        itemName: g.itemName,
        amount: g.amount,
        platformFee: g.platformFee,
        totalCharged: g.totalCharged,
        fulfillmentCost: g.fulfillmentCost,
        status: g.status,
        createdAt: g.createdAt,
        senderName: g.sender?.name || 'Unknown',
        // Estimated Stripe fee: 2.9% + $0.30
        stripeFee: g.totalCharged ? +(g.totalCharged * 0.029 + 0.30).toFixed(2) : 0,
        // Net margin: platformFee - fulfillmentCost - stripeFee
        netMargin: g.platformFee - (g.fulfillmentCost || 0) - (g.totalCharged ? g.totalCharged * 0.029 + 0.30 : 0),
      })),
    },
  })
}
