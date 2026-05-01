// Amazon Associates commission rates by category (April 2026 schedule).
// Used to bias the pool sort across /magic, /shop, /guides so that
// click-equivalent products with higher commissions surface first.
//
// Real Amazon rates (per Associates fee schedule):
//   - Luxury Beauty:        10%
//   - Furniture:             8%
//   - Jewelry:               6%
//   - Books / Music:         4.5%
//   - Apparel / Fashion:     4%
//   - Travel goods:          4%
//   - Wellness / Personal:   3%
//   - Sports / Fitness:      3%
//   - Kitchen:               2%
//   - PC / Tech:             2%
//   - Wireless / Misc:       0%
//
// Our `interests` tag is a rough proxy for category. We use conservative
// midpoints since most products span multiple subcategories.

const RATE_BY_INTEREST: Record<string, number> = {
  beauty:   0.10,  // luxury beauty
  home:     0.06,  // mid: furniture (8%) + general home goods (3%)
  fashion:  0.04,  // apparel
  travel:   0.04,  // luggage + travel accessories
  art:      0.04,  // art supplies + decor
  music:    0.045, // music + instruments
  reading:  0.045, // books
  outdoor:  0.04,  // sports + outdoor
  fitness:  0.03,  // sports + health
  wellness: 0.03,  // personal care
  cooking:  0.025, // kitchen
  tech:     0.02,  // electronics + PC
}

const DEFAULT_RATE = 0.04

/**
 * Estimate commission rate for a product. Uses the highest-rated interest
 * tag if multiple — pessimistic alternative is to use the lowest, but real
 * Amazon attribution attaches to the category at click time so the highest-
 * potential is fair.
 */
export function commissionRate(product: { interests: string[] | null; domain?: string | null }): number {
  // Non-Amazon products have no tagged commission for now (foreign Amazon
  // and other affiliates aren't wired). Return a low rate so they still
  // surface but get outranked by Amazon products at equal score.
  if (product.domain !== 'www.amazon.com' && product.domain !== 'amzn.to') {
    return 0.01  // de-prioritize non-Amazon
  }
  const tags = product.interests || []
  if (tags.length === 0) return DEFAULT_RATE
  let best = 0
  for (const t of tags) {
    const r = RATE_BY_INTEREST[t]
    if (r && r > best) best = r
  }
  return best || DEFAULT_RATE
}

/**
 * Multiplier applied to totalScore for ranking. Higher commission =
 * stronger boost. Capped so a great low-commission product still ranks
 * above a mediocre high-commission product.
 */
export function commissionMultiplier(product: { interests: string[] | null; domain?: string | null }): number {
  const r = commissionRate(product)
  // 10% = 1.5x, 4.5% = 1.0x, 2% = 0.6x — gentle taper
  return 0.5 + (r * 10)
}
