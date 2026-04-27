import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createTrackedLink } from '@/lib/product-link'

// POST /api/magic/picks
// Body: { name?, relationship?, interests: string[], priceTier: 'budget'|'mid'|'premium'|'luxury' }
// Returns: { picks: [{ name, image, price, priceValue, why, slug, domain, sources }] }
//
// The selection logic mirrors /shop's filters but is tighter: 3 picks at
// distinct price points within the budget tier, sorted by totalScore. We also
// weight in last-7d engagement (RETAILER_CLICK / WA_INTENT) so proven winners
// surface for first-time visitors.

const PRICE_RANGES: Record<string, [number, number]> = {
  budget:  [0,    30],
  mid:     [30,   75],
  premium: [75,   150],
  luxury:  [150,  10000],
}

const VALID_INTERESTS = new Set([
  'reading','home','fashion','tech','cooking','beauty','travel','art',
  'outdoor','fitness','music','wellness',
])

function pickAcrossPriceBand<T extends { priceValue: number | null }>(
  items: T[],
  count = 3,
): T[] {
  if (items.length <= count) return items
  // Sort by price, then take 3 evenly spaced ones (low/mid/high within the
  // pre-filtered band). Falls back to top-N if prices are missing.
  const priced = items.filter(i => typeof i.priceValue === 'number')
  if (priced.length < count) return items.slice(0, count)
  priced.sort((a, b) => (a.priceValue || 0) - (b.priceValue || 0))
  const step = Math.floor((priced.length - 1) / (count - 1))
  return Array.from({ length: count }, (_, i) => priced[i * step])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { name, relationship, interests = [], priceTier = 'mid' } = body as {
      name?: string
      relationship?: string
      interests?: string[]
      priceTier?: string
    }

    const interestTags = (Array.isArray(interests) ? interests : [])
      .filter(i => typeof i === 'string' && VALID_INTERESTS.has(i))

    const range = PRICE_RANGES[priceTier] || PRICE_RANGES.mid

    // Pull a wider pool first, then narrow.
    const pool = await prisma.tastemakerGift.findMany({
      where: {
        reviewStatus: 'approved',
        url: { not: null },
        image: { not: null },
        priceValue: { gte: range[0], lte: range[1] },
        // Match if ANY interest tag overlaps, OR fall back to no filter when
        // user picked no interests.
        ...(interestTags.length > 0
          ? { interests: { hasSome: interestTags } }
          : {}),
      },
      orderBy: { totalScore: 'desc' },
      take: 60,
      select: {
        id: true,
        name: true,
        price: true,
        priceValue: true,
        image: true,
        url: true,
        domain: true,
        why: true,
        sources: true,
        occasions: true,
        recipientTypes: true,
      },
    })

    if (pool.length === 0) {
      return NextResponse.json({ picks: [] })
    }

    // Boost click-engaged products: any product with retailer/card/WA clicks
    // in the last 7 days bubbles up. Cheap proxy for "this resonates."
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const clickRows = await prisma.$queryRaw<{ productName: string; clicks: bigint }[]>`
      SELECT pc."productName", COUNT(ce.id) as clicks
      FROM "ProductClick" pc
      JOIN "ClickEvent" ce ON ce.slug = pc.slug
      WHERE ce."createdAt" >= ${since}
        AND ce.event IN ('CARD_CLICK', 'RETAILER_CLICK', 'WA_INTENT')
      GROUP BY pc."productName"
    `
    const clickMap = new Map(clickRows.map(r => [r.productName, Number(r.clicks)]))
    pool.sort((a, b) => {
      const ac = clickMap.get(a.name) || 0
      const bc = clickMap.get(b.name) || 0
      if (ac !== bc) return bc - ac
      return 0 // keep totalScore order
    })

    // 3 picks across the price band, sorted by enriched score
    const picked = pickAcrossPriceBand(pool, 3)

    // Build tracked links for the 3 winners only (cheap)
    const withSlugs = await Promise.all(picked.map(async (p) => {
      let slug: string | undefined
      try {
        const trackedUrl = await createTrackedLink({
          productName: p.name,
          targetUrl: p.url!,
          price: p.price,
          priceValue: p.priceValue,
          image: p.image,
          source: 'MAGIC',
        })
        slug = trackedUrl.split('/p/')[1]
      } catch {}

      // Personalized "why for them" — uses the recipient's name when given.
      const themLabel = name?.trim()
        ? name.trim()
        : (relationship || 'them')
      const personalIntro = name?.trim() && p.why
        ? `For ${themLabel} — ${p.why.charAt(0).toLowerCase()}${p.why.slice(1)}`
        : p.why || ''

      return {
        slug,
        name: p.name,
        price: p.price,
        priceValue: p.priceValue,
        image: p.image,
        domain: p.domain,
        why: personalIntro,
        sources: p.sources,
      }
    }))

    return NextResponse.json({ picks: withSlugs.filter(p => p.slug) })
  } catch (e: any) {
    console.error('[magic/picks] error', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
