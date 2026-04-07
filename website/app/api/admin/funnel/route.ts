import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ADMIN_USER_IDS = new Set(['cmliwct6c00009zxu0g7rns32'])

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId || !ADMIN_USER_IDS.has(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const range = request.nextUrl.searchParams.get('range') || '7d'
  const daysBack = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 7
  const since = new Date(Date.now() - daysBack * 86400000)

  const [
    totalLinks,
    impressions,
    pageViews,
    retailerClicks,
    eventsByDay,
    topProducts,
    channelBreakdown,
    recentEvents,
  ] = await Promise.all([
    // Total product links created in period
    prisma.productClick.count({ where: { createdAt: { gte: since } } }),

    // Impressions (shown in chat)
    prisma.clickEvent.count({ where: { event: 'IMPRESSION', createdAt: { gte: since } } }),

    // Product page views
    prisma.clickEvent.count({ where: { event: 'PAGE_VIEW', createdAt: { gte: since } } }),

    // Retailer click-throughs
    prisma.clickEvent.count({ where: { event: 'RETAILER_CLICK', createdAt: { gte: since } } }),

    // Events grouped by day
    prisma.$queryRaw<{ day: string; event: string; count: bigint }[]>`
      SELECT DATE("createdAt") as day, event, COUNT(*) as count
      FROM "ClickEvent"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt"), event
      ORDER BY day DESC
    `,

    // Top products by funnel stage
    prisma.$queryRaw<{ slug: string; productName: string; impressions: bigint; page_views: bigint; retailer_clicks: bigint }[]>`
      SELECT
        pc.slug,
        pc."productName",
        COALESCE(SUM(CASE WHEN ce.event = 'IMPRESSION' THEN 1 ELSE 0 END), 0) as impressions,
        COALESCE(SUM(CASE WHEN ce.event = 'PAGE_VIEW' THEN 1 ELSE 0 END), 0) as page_views,
        COALESCE(SUM(CASE WHEN ce.event = 'RETAILER_CLICK' THEN 1 ELSE 0 END), 0) as retailer_clicks
      FROM "ProductClick" pc
      LEFT JOIN "ClickEvent" ce ON ce.slug = pc.slug AND ce."createdAt" >= ${since}
      WHERE pc."createdAt" >= ${since}
      GROUP BY pc.slug, pc."productName"
      ORDER BY impressions DESC
      LIMIT 30
    `,

    // Channel breakdown
    prisma.$queryRaw<{ channel: string; event: string; count: bigint }[]>`
      SELECT COALESCE(channel, 'UNKNOWN') as channel, event, COUNT(*) as count
      FROM "ClickEvent"
      WHERE "createdAt" >= ${since}
      GROUP BY channel, event
    `,

    // Recent events (last 50)
    prisma.clickEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { product: { select: { productName: true, price: true } } },
    }),
  ])

  // Compute conversion rates
  const viewRate = impressions > 0 ? Math.round((pageViews / impressions) * 100) : 0
  const clickRate = pageViews > 0 ? Math.round((retailerClicks / pageViews) * 100) : 0
  const overallRate = impressions > 0 ? Math.round((retailerClicks / impressions) * 100) : 0

  // Format daily data
  const dailyData: Record<string, { impressions: number; page_views: number; retailer_clicks: number }> = {}
  for (const row of eventsByDay) {
    const day = String(row.day).split('T')[0]
    if (!dailyData[day]) dailyData[day] = { impressions: 0, page_views: 0, retailer_clicks: 0 }
    const count = Number(row.count)
    if (row.event === 'IMPRESSION') dailyData[day].impressions = count
    else if (row.event === 'PAGE_VIEW') dailyData[day].page_views = count
    else if (row.event === 'RETAILER_CLICK') dailyData[day].retailer_clicks = count
  }

  // Format channel data
  const channels: Record<string, { impressions: number; page_views: number; retailer_clicks: number }> = {}
  for (const row of channelBreakdown) {
    const ch = row.channel || 'UNKNOWN'
    if (!channels[ch]) channels[ch] = { impressions: 0, page_views: 0, retailer_clicks: 0 }
    const count = Number(row.count)
    if (row.event === 'IMPRESSION') channels[ch].impressions = count
    else if (row.event === 'PAGE_VIEW') channels[ch].page_views = count
    else if (row.event === 'RETAILER_CLICK') channels[ch].retailer_clicks = count
  }

  return NextResponse.json({
    range,
    funnel: {
      recommendations: totalLinks,
      impressions,
      pageViews,
      retailerClicks,
      viewRate,
      clickRate,
      overallRate,
    },
    daily: dailyData,
    topProducts: topProducts.map(p => ({
      slug: p.slug,
      name: p.productName,
      impressions: Number(p.impressions),
      pageViews: Number(p.page_views),
      retailerClicks: Number(p.retailer_clicks),
    })),
    channels,
    recentEvents: recentEvents.map(e => ({
      id: e.id,
      event: e.event,
      channel: e.channel,
      product: e.product.productName,
      price: e.product.price,
      createdAt: e.createdAt,
    })),
  })
}
