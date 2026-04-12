import { prisma } from './db'
import type { CatalogProduct } from '@prisma/client'

export interface RecommendationRequest {
  recipient?: string      // "mom", "sister", "friend", etc.
  occasion?: string       // "birthday", "mothers_day", etc.
  budget?: string         // "BUDGET", "MID", "PREMIUM", "LUXURY" or specific amount like "$50"
  interests?: string[]    // ["cooking", "fitness"]
  vibes?: string[]        // ["minimalist", "luxe"]
  themes?: string[]       // ["tech", "wellness"]
  excludeIds?: string[]   // products already shown
  limit?: number          // default 3
}

// Bayesian smoothing prior: assume 5 impressions with 2% CTR for new products
const PRIOR_IMPRESSIONS = 5
const PRIOR_CLICKS = 0.1

/**
 * Calculate intersection size between two string arrays (case-insensitive).
 */
function overlap(a: string[], b: string[]): number {
  const setB = new Set(b.map(s => s.toLowerCase()))
  return a.filter(s => setB.has(s.toLowerCase())).length
}

/**
 * Parse budget string into a price tier or numeric range.
 */
function parseBudget(budget: string): { tier?: string; minPrice?: number; maxPrice?: number } {
  const upper = budget.toUpperCase()
  if (['BUDGET', 'MID', 'PREMIUM', 'LUXURY'].includes(upper)) {
    return { tier: upper }
  }
  // Try to parse as a dollar amount
  const num = parseFloat(budget.replace(/[^0-9.]/g, ''))
  if (!isNaN(num)) {
    if (num <= 35) return { tier: 'BUDGET' }
    if (num <= 100) return { tier: 'MID' }
    if (num <= 150) return { tier: 'PREMIUM' }
    return { tier: 'LUXURY' }
  }
  return {}
}

/**
 * Score a product against a recommendation request.
 * Returns a composite score from 0-1 based on dimension matches and engagement.
 */
function scoreProduct(product: CatalogProduct, req: RecommendationRequest): number {
  let dimensionScore = 0
  let maxDimensionScore = 0

  // Recipient match (high weight)
  if (req.recipient) {
    maxDimensionScore += 3
    if (product.recipients.some(r => r.toLowerCase() === req.recipient!.toLowerCase())) {
      dimensionScore += 3
    }
  }

  // Occasion match (high weight)
  if (req.occasion) {
    maxDimensionScore += 3
    if (product.occasions.some(o => o.toLowerCase() === req.occasion!.toLowerCase())) {
      dimensionScore += 3
    }
  }

  // Interests overlap (medium weight)
  if (req.interests && req.interests.length > 0) {
    maxDimensionScore += 2
    const interestOverlap = overlap(req.interests, product.interests)
    dimensionScore += Math.min(2, (interestOverlap / req.interests.length) * 2)
  }

  // Themes overlap (medium weight)
  if (req.themes && req.themes.length > 0) {
    maxDimensionScore += 2
    const themeOverlap = overlap(req.themes, product.themes)
    dimensionScore += Math.min(2, (themeOverlap / req.themes.length) * 2)
  }

  // Vibes overlap (lower weight)
  if (req.vibes && req.vibes.length > 0) {
    maxDimensionScore += 1
    const vibeOverlap = overlap(req.vibes, product.vibes)
    dimensionScore += Math.min(1, (vibeOverlap / req.vibes.length) * 1)
  }

  // Normalize dimension score to 0-1
  const normalizedDimension = maxDimensionScore > 0 ? dimensionScore / maxDimensionScore : 0.5

  // Engagement score with Bayesian smoothing
  const smoothedCtr = (product.clicks + PRIOR_CLICKS) / (product.impressions + PRIOR_IMPRESSIONS)
  const conversionRate = product.impressions > 10
    ? product.conversions / product.impressions
    : 0

  // Recency boost: newer products get a small bump (decays over 90 days)
  const ageInDays = (Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  const recencyBoost = Math.max(0, 1 - ageInDays / 90)

  // Composite engagement: 0.6 * CTR + 0.3 * conversion + 0.1 * recency
  const engagementScore = (0.6 * smoothedCtr) + (0.3 * conversionRate) + (0.1 * recencyBoost)

  // Final score: 70% dimension match + 30% engagement
  return 0.7 * normalizedDimension + 0.3 * engagementScore
}

/**
 * Recommend products from the curated catalog.
 * Filters by hard constraints, scores by dimension match + engagement, ensures diversity.
 */
export async function recommendProducts(req: RecommendationRequest): Promise<CatalogProduct[]> {
  const limit = req.limit ?? 3
  const excludeIds = new Set(req.excludeIds || [])

  // Build Prisma where clause for hard filters
  const where: Record<string, unknown> = { isActive: true }

  if (req.budget) {
    const parsed = parseBudget(req.budget)
    if (parsed.tier) {
      where.priceTier = parsed.tier
    }
  }

  // Fetch candidate pool (broader than needed, filter in JS for flexibility)
  const candidates = await prisma.catalogProduct.findMany({
    where: where as any,
    orderBy: { score: 'desc' },
    take: 100, // fetch a broad pool
  })

  // Filter out excluded products
  const filtered = candidates.filter(p => !excludeIds.has(p.id))

  // Score each product
  const scored = filtered.map(p => ({
    product: p,
    score: scoreProduct(p, req),
  }))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Ensure diversity: at least 2 different price tiers when limit >= 3
  const results: CatalogProduct[] = []
  const usedTiers = new Set<string>()
  const usedBrands = new Set<string>()

  // First pass: pick the top scorer
  for (const item of scored) {
    if (results.length >= limit) break
    results.push(item.product)
    usedTiers.add(item.product.priceTier)
    if (item.product.brand) usedBrands.add(item.product.brand)
  }

  // If limit >= 3 and we only have 1 price tier, swap in products from other tiers
  if (limit >= 3 && usedTiers.size < 2 && results.length >= 2) {
    // Find the best product from a different tier
    const currentTier = results[0].priceTier
    const differentTier = scored.find(s =>
      s.product.priceTier !== currentTier && !results.some(r => r.id === s.product.id)
    )
    if (differentTier) {
      // Replace the lowest-scoring result
      results[results.length - 1] = differentTier.product
    }
  }

  // Ensure brand diversity: no more than 2 from the same brand
  if (results.length >= 3) {
    const brandCounts = new Map<string, number>()
    for (const r of results) {
      if (r.brand) {
        brandCounts.set(r.brand, (brandCounts.get(r.brand) || 0) + 1)
      }
    }
    for (const [brand, count] of brandCounts) {
      if (count > 2) {
        // Find a replacement
        const replacement = scored.find(s =>
          s.product.brand !== brand && !results.some(r => r.id === s.product.id)
        )
        if (replacement) {
          // Replace the last duplicate-brand product
          const idx = results.findLastIndex(r => r.brand === brand)
          if (idx >= 0) results[idx] = replacement.product
        }
      }
    }
  }

  return results.slice(0, limit)
}
