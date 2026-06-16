import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Returns structured "what's working" data for the autonomous FB content
// bot to pull from. Same auth model as cron endpoints (bearer CRON_SECRET).
//
// Includes:
//   - top 8 products by retailer clicks last 7 days (with image, link, host)
//   - top 8 FD-relevant products by retailer clicks last 7 days
//   - rolling totals (clicks 24h / 7d / 30d)
//   - days till Father's Day (auto-hides after the holiday)

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  type Row = {
    name: string
    image: string | null
    url: string | null
    domain: string | null
    price: string | null
    why: string | null
    clicks: number
  }

  const topAll = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT tg.name, tg.image, tg.url, tg.domain, tg.price, tg.why,
           COALESCE(SUM(ce_count.c), 0)::int AS clicks
    FROM "TastemakerGift" tg
    JOIN "ProductClick" pc ON pc."productName" = tg.name
    JOIN LATERAL (
      SELECT COUNT(*)::int AS c
      FROM "ClickEvent" ce
      WHERE ce.slug = pc.slug
        AND ce."createdAt" >= NOW() - INTERVAL '7 days'
        AND ce.event = 'RETAILER_CLICK'
    ) ce_count ON TRUE
    WHERE tg."reviewStatus" = 'approved'
      AND tg.image IS NOT NULL
      AND tg.url IS NOT NULL
    GROUP BY tg.id
    HAVING COALESCE(SUM(ce_count.c), 0) > 0
    ORDER BY clicks DESC
    LIMIT 8
  `)

  const topFD = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT tg.name, tg.image, tg.url, tg.domain, tg.price, tg.why,
           COALESCE(SUM(ce_count.c), 0)::int AS clicks
    FROM "TastemakerGift" tg
    JOIN "ProductClick" pc ON pc."productName" = tg.name
    JOIN LATERAL (
      SELECT COUNT(*)::int AS c
      FROM "ClickEvent" ce
      WHERE ce.slug = pc.slug
        AND ce."createdAt" >= NOW() - INTERVAL '7 days'
        AND ce.event = 'RETAILER_CLICK'
    ) ce_count ON TRUE
    WHERE tg."reviewStatus" = 'approved'
      AND tg.image IS NOT NULL
      AND tg.url IS NOT NULL
      AND (
        'fathers-day' = ANY(tg.occasions) OR
        'dad' = ANY(tg."recipientTypes") OR
        'father' = ANY(tg."recipientTypes")
      )
    GROUP BY tg.id
    HAVING COALESCE(SUM(ce_count.c), 0) > 0
    ORDER BY clicks DESC
    LIMIT 8
  `)

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [clicks24h, clicks7d, clicks30d] = await Promise.all([
    prisma.clickEvent.count({ where: { createdAt: { gte: since24h }, event: 'RETAILER_CLICK' } }),
    prisma.clickEvent.count({ where: { createdAt: { gte: since7d }, event: 'RETAILER_CLICK' } }),
    prisma.clickEvent.count({ where: { createdAt: { gte: since30d }, event: 'RETAILER_CLICK' } }),
  ])

  const FATHERS_DAY = new Date('2026-06-21T07:00:00Z')
  const now = new Date()
  const daysToFD = Math.ceil((FATHERS_DAY.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  const fdActive = daysToFD >= 0 && daysToFD <= 14

  return NextResponse.json({
    generated_at: now.toISOString(),
    fathers_day: { date: '2026-06-21', days_until: daysToFD, push_active: fdActive },
    retailer_clicks: { last_24h: clicks24h, last_7d: clicks7d, last_30d: clicks30d },
    top_clicked_products: topAll,
    top_clicked_fd_products: topFD,
  })
}
