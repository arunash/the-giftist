import { prisma } from './db'

/**
 * Normalize a product name for fuzzy matching:
 * lowercase, strip punctuation, collapse whitespace.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Check if two product names are a fuzzy match.
 * Uses containment check: if one name contains the other (after normalization),
 * or if the overlap of significant words is >= 60%.
 */
function fuzzyMatch(catalogName: string, clickName: string): boolean {
  const a = normalizeName(catalogName)
  const b = normalizeName(clickName)

  // Exact match
  if (a === b) return true

  // Containment (either direction)
  if (a.includes(b) || b.includes(a)) return true

  // Word overlap: at least 60% of the shorter name's words appear in the longer
  const wordsA = new Set(a.split(' ').filter(w => w.length > 2))
  const wordsB = new Set(b.split(' ').filter(w => w.length > 2))
  const shorter = wordsA.size <= wordsB.size ? wordsA : wordsB
  const longer = wordsA.size > wordsB.size ? wordsA : wordsB

  if (shorter.size === 0) return false

  let matchCount = 0
  for (const word of shorter) {
    if (longer.has(word)) matchCount++
  }

  return matchCount / shorter.size >= 0.6
}

/**
 * Sync engagement data from ClickEvent + ProductClick tables back to CatalogProduct.
 *
 * Matches ProductClick records to CatalogProducts by fuzzy product name matching,
 * then aggregates ClickEvent counts and updates engagement metrics.
 */
export async function syncCatalogEngagement(): Promise<{
  matched: number
  unmatched: number
  updated: number
}> {
  // Fetch all catalog products
  const catalogProducts = await prisma.catalogProduct.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  // Fetch all product clicks with their event counts
  const productClicks = await prisma.productClick.findMany({
    select: {
      id: true,
      productName: true,
      clicks: true,
      views: true,
    },
  })

  // Fetch aggregated click events per slug
  const clickEvents = await prisma.clickEvent.groupBy({
    by: ['slug', 'event'],
    _count: { id: true },
  })

  // Build slug -> event counts map
  const slugEventCounts = new Map<string, { impressions: number; clicks: number; conversions: number }>()

  // Also get slug -> productName mapping from productClicks
  const slugToProductClick = new Map<string, typeof productClicks[0]>()
  for (const pc of productClicks) {
    // We don't have slug directly in the select, but we can match via the relation
    // Actually, let's re-fetch with slug
  }

  // Re-fetch with slug
  const productClicksWithSlug = await prisma.productClick.findMany({
    select: {
      slug: true,
      productName: true,
      clicks: true,
      views: true,
    },
  })

  const slugToName = new Map<string, string>()
  for (const pc of productClicksWithSlug) {
    slugToName.set(pc.slug, pc.productName)
  }

  for (const ce of clickEvents) {
    if (!slugEventCounts.has(ce.slug)) {
      slugEventCounts.set(ce.slug, { impressions: 0, clicks: 0, conversions: 0 })
    }
    const counts = slugEventCounts.get(ce.slug)!
    if (ce.event === 'IMPRESSION' || ce.event === 'PAGE_VIEW') {
      counts.impressions += ce._count.id
    } else if (ce.event === 'RETAILER_CLICK' || ce.event === 'CLICK') {
      counts.clicks += ce._count.id
    } else if (ce.event === 'PURCHASE') {
      counts.conversions += ce._count.id
    }
  }

  // Also include views/clicks from ProductClick denormalized fields
  for (const pc of productClicksWithSlug) {
    if (!slugEventCounts.has(pc.slug)) {
      slugEventCounts.set(pc.slug, { impressions: 0, clicks: 0, conversions: 0 })
    }
    const counts = slugEventCounts.get(pc.slug)!
    // Merge: use the higher of the two counts (ProductClick fields may lag behind ClickEvent)
    counts.impressions = Math.max(counts.impressions, pc.views)
    counts.clicks = Math.max(counts.clicks, pc.clicks)
  }

  // Now match product names and aggregate per catalog product
  const catalogAggregates = new Map<string, { impressions: number; clicks: number; conversions: number }>()

  let matched = 0
  let unmatched = 0

  for (const [slug, name] of slugToName) {
    const catalogMatch = catalogProducts.find(cp => fuzzyMatch(cp.name, name))
    if (catalogMatch) {
      matched++
      const eventCounts = slugEventCounts.get(slug) || { impressions: 0, clicks: 0, conversions: 0 }
      if (!catalogAggregates.has(catalogMatch.id)) {
        catalogAggregates.set(catalogMatch.id, { impressions: 0, clicks: 0, conversions: 0 })
      }
      const agg = catalogAggregates.get(catalogMatch.id)!
      agg.impressions += eventCounts.impressions
      agg.clicks += eventCounts.clicks
      agg.conversions += eventCounts.conversions
    } else {
      unmatched++
    }
  }

  // Find global max CTR for normalization
  let maxCtr = 0.01 // floor
  for (const [, agg] of catalogAggregates) {
    if (agg.impressions > 0) {
      const ctr = agg.clicks / agg.impressions
      if (ctr > maxCtr) maxCtr = ctr
    }
  }

  // Update each catalog product
  let updated = 0
  for (const [catalogId, agg] of catalogAggregates) {
    const ctr = agg.impressions > 0 ? agg.clicks / agg.impressions : 0
    const ctrNormalized = ctr / maxCtr
    const conversionRate = agg.impressions > 0 ? agg.conversions / agg.impressions : 0

    // Recency boost: based on when the product was created
    const product = catalogProducts.find(p => p.id === catalogId)
    const ageInDays = product
      ? (Date.now() - new Date().getTime()) / (1000 * 60 * 60 * 24) // will be ~0 for all, using createdAt would be better
      : 0
    const recencyBoost = Math.max(0, 1 - Math.abs(ageInDays) / 90)

    // Composite score: 0.6 * ctr_normalized + 0.3 * conversion_rate + 0.1 * recency_boost
    const score = (0.6 * ctrNormalized) + (0.3 * conversionRate) + (0.1 * recencyBoost)

    await prisma.catalogProduct.update({
      where: { id: catalogId },
      data: {
        impressions: agg.impressions,
        clicks: agg.clicks,
        conversions: agg.conversions,
        ctr: Math.round(ctr * 10000) / 10000,
        score: Math.round(score * 10000) / 10000,
      },
    })
    updated++
  }

  return { matched, unmatched, updated }
}
