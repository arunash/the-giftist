import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ADMIN_USER_IDS = new Set(['cmliwct6c00009zxu0g7rns32'])

/**
 * Funnel: ad → /shop → product card click → /p/SLUG view → WhatsApp intent.
 * Designed for the post-WhatsApp-CTWA acquisition strategy where users land
 * on /shop from Meta ads and the goal is to push them into a WA conversation.
 */
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
    shopViews,
    shopUniqueSessions,
    cardClicks,
    productPageViews,
    waIntents,
    byCampaign,
    daily,
  ] = await Promise.all([
    // /shop visits (raw — multiple per session counted)
    prisma.pageView.count({
      where: { path: { startsWith: '/shop' }, createdAt: { gte: since } },
    }),

    // /shop unique sessions
    prisma.pageView.findMany({
      where: { path: { startsWith: '/shop' }, createdAt: { gte: since }, sessionId: { not: null } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    }).then(rows => rows.length),

    // Product card clicks on /shop
    prisma.clickEvent.count({
      where: { event: 'CARD_CLICK', createdAt: { gte: since } },
    }),

    // /p/SLUG views
    prisma.clickEvent.count({
      where: { event: 'PAGE_VIEW', channel: 'WEB', createdAt: { gte: since } },
    }),

    // WA intent clicks (the new "Order via WhatsApp" CTA)
    prisma.clickEvent.count({
      where: { event: 'WA_INTENT', createdAt: { gte: since } },
    }),

    // By UTM campaign — only useful once ads are pointing to /shop
    prisma.$queryRaw<{ utm_campaign: string | null; utm_source: string | null; sessions: bigint; views: bigint }[]>`
      SELECT
        "utmCampaign" as utm_campaign,
        "utmSource" as utm_source,
        COUNT(DISTINCT "sessionId") as sessions,
        COUNT(*) as views
      FROM "PageView"
      WHERE "createdAt" >= ${since}
        AND "path" LIKE '/shop%'
      GROUP BY "utmCampaign", "utmSource"
      ORDER BY sessions DESC
      LIMIT 30
    `,

    // Daily breakdown
    prisma.$queryRaw<{ day: string; metric: string; count: bigint }[]>`
      SELECT day, metric, count FROM (
        SELECT DATE("createdAt") as day, 'shop_view' as metric, COUNT(*) as count
        FROM "PageView"
        WHERE "createdAt" >= ${since} AND "path" LIKE '/shop%'
        GROUP BY DATE("createdAt")
        UNION ALL
        SELECT DATE("createdAt") as day, event as metric, COUNT(*) as count
        FROM "ClickEvent"
        WHERE "createdAt" >= ${since}
          AND event IN ('CARD_CLICK', 'PAGE_VIEW', 'WA_INTENT')
        GROUP BY DATE("createdAt"), event
      ) t
      ORDER BY day DESC
    `,
  ])

  const cardCtr = shopUniqueSessions > 0 ? Math.round((cardClicks / shopUniqueSessions) * 100) : 0
  const pageViewRate = cardClicks > 0 ? Math.round((productPageViews / cardClicks) * 100) : 0
  const waConversion = productPageViews > 0 ? Math.round((waIntents / productPageViews) * 100) : 0
  const overall = shopUniqueSessions > 0 ? Math.round((waIntents / shopUniqueSessions) * 1000) / 10 : 0

  // Format daily
  const dailyMap: Record<string, Record<string, number>> = {}
  for (const row of daily) {
    const day = String(row.day).split('T')[0]
    if (!dailyMap[day]) dailyMap[day] = { shop_view: 0, CARD_CLICK: 0, PAGE_VIEW: 0, WA_INTENT: 0 }
    dailyMap[day][row.metric] = Number(row.count)
  }

  return NextResponse.json({
    range,
    funnel: {
      shopViews,
      shopUniqueSessions,
      cardClicks,
      productPageViews,
      waIntents,
      cardCtr,        // % of unique shop sessions that clicked a card
      pageViewRate,   // % of card clicks that landed on /p/SLUG (sanity check)
      waConversion,   // % of /p views that triggered WA_INTENT
      overall,        // % of shop sessions that triggered WA_INTENT
    },
    byCampaign: byCampaign.map(c => ({
      utmSource: c.utm_source,
      utmCampaign: c.utm_campaign,
      sessions: Number(c.sessions),
      views: Number(c.views),
    })),
    daily: dailyMap,
  })
}
