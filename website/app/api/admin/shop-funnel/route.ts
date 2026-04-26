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
    retailerClicksRaw,
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

    // Retailer clicks joined to ProductClick so we know the destination domain
    prisma.$queryRaw<{ slug: string; targetUrl: string; productName: string; clicks: bigint }[]>`
      SELECT pc.slug, pc."targetUrl", pc."productName", COUNT(ce.id) as clicks
      FROM "ClickEvent" ce
      JOIN "ProductClick" pc ON pc.slug = ce.slug
      WHERE ce.event = 'RETAILER_CLICK'
        AND ce."createdAt" >= ${since}
      GROUP BY pc.slug, pc."targetUrl", pc."productName"
      ORDER BY clicks DESC
    `,

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

  // Affiliate program categorization. Mirrors lib/affiliate.ts.
  // commissionRate is a rough estimate for revenue projection — actual rates
  // vary by category and product. Source: each affiliate program's standard tier.
  type AffiliateInfo = { program: string; commissionRate: number }
  const AFFILIATE_PROGRAMS: Array<{ match: RegExp; info: AffiliateInfo }> = [
    { match: /amazon\.\w+|amzn\.to/i,           info: { program: 'Amazon Associates',    commissionRate: 0.03 } },
    { match: /etsy\.com/i,                       info: { program: 'Etsy (Awin)',           commissionRate: 0.04 } },
    { match: /walmart\.com/i,                    info: { program: 'Walmart',               commissionRate: 0.04 } },
    { match: /target\.com/i,                     info: { program: 'Target (Impact)',       commissionRate: 0.05 } },
    { match: /uncommongoods\.com/i,              info: { program: 'Uncommon Goods (Impact)', commissionRate: 0.10 } },
    { match: /bookshop\.org/i,                   info: { program: 'Bookshop (Awin)',       commissionRate: 0.10 } },
    { match: /masterclass\.com/i,                info: { program: 'MasterClass (ShareASale)', commissionRate: 0.15 } },
    { match: /cratejoy\.com/i,                   info: { program: 'Cratejoy (Impact)',     commissionRate: 0.15 } },
    { match: /food52\.com/i,                     info: { program: 'Food52 (Partnerize)',   commissionRate: 0.10 } },
    { match: /nordstrom\.com/i,                  info: { program: 'Nordstrom (Rakuten)',   commissionRate: 0.05 } },
  ]

  function classify(url: string): { domain: string; affiliate: AffiliateInfo | null } {
    let domain = 'unknown'
    try { domain = new URL(url).hostname.replace(/^www\./, '') } catch {}
    for (const { match, info } of AFFILIATE_PROGRAMS) {
      if (match.test(url)) return { domain, affiliate: info }
    }
    return { domain, affiliate: null }
  }

  // Aggregate retailer clicks by program, plus per-product breakdown
  const retailerClicks: Array<{
    slug: string
    productName: string
    targetUrl: string
    clicks: number
    domain: string
    affiliate: AffiliateInfo | null
    estCommissionUsd: number   // very rough — assumes 5% click→purchase, avg $50 cart
  }> = retailerClicksRaw.map(r => {
    const c = classify(r.targetUrl)
    const clicks = Number(r.clicks)
    // Conservative projection: 5% of clicks convert to purchase, $50 avg basket.
    const estCommissionUsd = c.affiliate
      ? Math.round(clicks * 0.05 * 50 * c.affiliate.commissionRate * 100) / 100
      : 0
    return {
      slug: r.slug, productName: r.productName, targetUrl: r.targetUrl, clicks,
      domain: c.domain, affiliate: c.affiliate, estCommissionUsd,
    }
  })

  // Group by affiliate program
  const byProgram = new Map<string, { program: string; clicks: number; commissionRate: number; estCommissionUsd: number; products: number }>()
  let totalRetailerClicks = 0, totalAffiliateClicks = 0, totalEstCommission = 0
  const programProducts = new Map<string, Set<string>>()
  for (const r of retailerClicks) {
    totalRetailerClicks += r.clicks
    if (r.affiliate) {
      totalAffiliateClicks += r.clicks
      totalEstCommission += r.estCommissionUsd
      const key = r.affiliate.program
      const cur = byProgram.get(key) || { program: key, clicks: 0, commissionRate: r.affiliate.commissionRate, estCommissionUsd: 0, products: 0 }
      cur.clicks += r.clicks
      cur.estCommissionUsd += r.estCommissionUsd
      byProgram.set(key, cur)
      if (!programProducts.has(key)) programProducts.set(key, new Set())
      programProducts.get(key)!.add(r.slug)
    }
  }
  for (const [k, v] of Array.from(byProgram.entries())) {
    v.products = programProducts.get(k)?.size || 0
  }

  const affiliateBreakdown = {
    totalRetailerClicks,
    totalAffiliateClicks,
    nonAffiliateClicks: totalRetailerClicks - totalAffiliateClicks,
    coveragePct: totalRetailerClicks > 0 ? Math.round((totalAffiliateClicks / totalRetailerClicks) * 100) : 0,
    estCommissionLowUsd: Math.round(totalEstCommission * 0.5 * 100) / 100,    // 50% of base estimate
    estCommissionMidUsd: Math.round(totalEstCommission * 100) / 100,           // base estimate
    estCommissionHighUsd: Math.round(totalEstCommission * 2 * 100) / 100,      // 2× base
    byProgram: Array.from(byProgram.values()).sort((a, b) => b.clicks - a.clicks),
    topProducts: retailerClicks.slice(0, 15),
  }

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
    affiliate: affiliateBreakdown,
    byCampaign: byCampaign.map(c => ({
      utmSource: c.utm_source,
      utmCampaign: c.utm_campaign,
      sessions: Number(c.sessions),
      views: Number(c.views),
    })),
    daily: dailyMap,
  })
}
