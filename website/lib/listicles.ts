// Templated SEO listicles. Each one renders at /gifts/[slug] as a static
// (ISR-cached) server-rendered page targeting a long-tail gift query.
//
// Strategy: at the 80-clicks-per-$1 commission rate paid ads can't pay for
// themselves. SEO listicles produce free traffic that compounds over weeks —
// the only acquisition channel that pencils at this commission economics.
//
// Each listicle:
//   - has an SEO-targeted title + meta description
//   - filters the catalog by tag/price/domain
//   - prefers amazon.com products (those are the only retailers we have an
//     active Associates account for) but doesn't hard-filter (some listicles
//     would shrink to <5 picks)
//   - 12-18 items, each rendered as a card with Gift-via-Giftist as primary CTA

export interface Listicle {
  slug: string
  title: string         // H1
  metaTitle: string     // <title>
  description: string   // <meta description> + og:description
  intro: string         // paragraph under H1
  filter: {
    interests?: string[]
    occasions?: string[]
    recipientTypes?: string[]
    priceMin?: number
    priceMax?: number
  }
  limit?: number
  hashtags?: string[]   // for Pinterest pinning
}

export const LISTICLES: Listicle[] = [
  {
    slug: 'mothers-day-under-50',
    title: 'Mother\'s Day Gifts Under $50 (2026)',
    metaTitle: '15 Best Mother\'s Day Gifts Under $50 — 2026 | Giftist',
    description: 'Curated Mother\'s Day gifts under $50, vetted by Wirecutter, NY Mag, and real expert reviews. Amazon Prime-eligible — order by May 6 for delivery before May 10.',
    intro: 'These are the picks we\'d send our own moms — under $50, mostly Amazon Prime so they ship fast. Each one\'s been backed by Wirecutter, NY Mag\'s Strategist, or Oprah\'s editors. Order by May 6 to arrive before May 10.',
    filter: { occasions: ['mothers-day'], priceMax: 50 },
    limit: 18,
    hashtags: ['#MothersDayGifts', '#GiftsForMom', '#MothersDay2026'],
  },
  {
    slug: 'mothers-day-50-to-100',
    title: 'Mother\'s Day Gifts $50–100',
    metaTitle: 'Best Mother\'s Day Gifts $50 to $100 — 2026 | Giftist',
    description: 'Thoughtful Mother\'s Day gifts in the $50–$100 range. Real expert picks, Prime-shippable, and ready to gift before May 10.',
    intro: 'The sweet-spot price tier — premium enough to feel special, accessible enough to make sense. Every pick on this list is something we\'d actually buy for our own moms.',
    filter: { occasions: ['mothers-day'], priceMin: 50, priceMax: 100 },
    limit: 15,
    hashtags: ['#MothersDayGifts', '#GiftsForMom'],
  },
  {
    slug: 'mothers-day-luxury',
    title: 'Luxury Mother\'s Day Gifts ($150+)',
    metaTitle: 'Luxury Mother\'s Day Gifts $150+ — 2026 | Giftist',
    description: 'Statement Mother\'s Day gifts at the premium tier — vetted picks in beauty, kitchen, and home that moms genuinely treasure.',
    intro: 'For when "thoughtful" deserves wrapping that matches. These are the indulgences moms would buy for themselves — but probably haven\'t. All hand-vetted, none chosen by algorithm.',
    filter: { occasions: ['mothers-day'], priceMin: 150 },
    limit: 12,
    hashtags: ['#LuxuryMothersDay', '#MothersDayGifts'],
  },
  {
    slug: 'books-for-mom',
    title: 'Best Books to Gift Mom (Mother\'s Day 2026)',
    metaTitle: '20 Best Books to Gift Mom — Mother\'s Day 2026 | Giftist',
    description: 'Bestselling, beloved book picks for moms — fiction, memoir, and feel-good reads. All on Amazon, Prime-eligible, ships in 2 days.',
    intro: 'A great book is the lowest-risk Mother\'s Day gift: easy to ship, easy to love. These are titles moms actually finish — selected from the Wirecutter, Strategist, and Reddit favorites.',
    filter: { interests: ['reading'], recipientTypes: ['mom', 'universal'] },
    limit: 20,
    hashtags: ['#BooksForMom', '#GiftBooks'],
  },
  {
    slug: 'mothers-day-self-care',
    title: 'Mother\'s Day Self-Care Gifts',
    metaTitle: 'Best Self-Care Mother\'s Day Gifts — 2026 | Giftist',
    description: 'Spa, beauty, and wellness gifts for moms who deserve the pause. Curated from Wirecutter, NY Mag, and Sephora\'s top reviews.',
    intro: 'The "treat yourself" tier — bath rituals, premium skincare, things that make 20 minutes feel like an hour. Curated picks that signal: take a break, you\'ve earned it.',
    filter: { occasions: ['mothers-day'], interests: ['beauty', 'wellness'] },
    limit: 15,
    hashtags: ['#SelfCareGifts', '#MothersDayGifts'],
  },
  {
    slug: 'mothers-day-last-minute',
    title: 'Last-Minute Mother\'s Day Gifts (Prime Shipping)',
    metaTitle: 'Last-Minute Mother\'s Day Gifts — Prime 2-Day Ship | Giftist',
    description: 'Procrastinated? These Mother\'s Day gifts ship in 2 days via Amazon Prime. Order by May 8 to arrive in time for May 10.',
    intro: 'Procrastinated? Same. These are all on Amazon Prime — order by May 8 (Friday) and they\'ll arrive before Mother\'s Day. No gift-wrap needed for this list; pick something good and we\'ll send it.',
    filter: { occasions: ['mothers-day'] },
    limit: 12,
    hashtags: ['#LastMinuteGifts', '#MothersDayGifts'],
  },
  {
    slug: 'cooking-gifts-for-mom',
    title: 'Cooking Gifts Mom Will Actually Use',
    metaTitle: 'Best Cooking Gifts for Mom — Curated 2026 | Giftist',
    description: 'Premium kitchen gear, gourmet ingredients, and cooking-class subscriptions for moms who love to cook. Vetted by experts, all on Amazon.',
    intro: 'For the mom who turns the kitchen into a happy place. These picks are weight-tested, dishwasher-survived, and actually-used in real kitchens. Le Creuset to artisan olive oils — every category covered.',
    filter: { interests: ['cooking'], recipientTypes: ['mom', 'universal'] },
    limit: 16,
    hashtags: ['#CookingGifts', '#GiftsForMom', '#KitchenGifts'],
  },
  {
    slug: 'home-gifts-for-mom',
    title: 'Home & Decor Gifts for Mom',
    metaTitle: 'Best Home Gifts for Mom — 2026 Curated Picks | Giftist',
    description: 'Cozy throws, statement vases, smart-home upgrades — home gifts moms love. Curated from Wirecutter, NY Mag, and Brooklinen.',
    intro: 'Things that make her place feel more like hers. Whether she\'s about cozy textures, sleek minimal upgrades, or that one perfect candle, this list pulls from the home goods we\'d actually buy ourselves.',
    filter: { interests: ['home'], recipientTypes: ['mom', 'universal'] },
    limit: 16,
    hashtags: ['#HomeGifts', '#GiftsForMom'],
  },
]

export function getListicle(slug: string): Listicle | undefined {
  return LISTICLES.find(l => l.slug === slug)
}
