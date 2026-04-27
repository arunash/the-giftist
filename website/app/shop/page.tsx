import { prisma } from '@/lib/db'
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { Gift, MessageCircle, Star } from 'lucide-react'
import { createTrackedLink } from '@/lib/product-link'
import { GiftGrid, GiftProduct } from './gift-grid'
import { EditorsPickCard } from './editors-pick-card'
import { ShopPageViewTracker } from './page-view-tracker'
import { ShopHero } from './shop-hero'
import { StickyConciergeBar } from './sticky-concierge-bar'
import { PicksCarousel } from './picks-carousel'

export const revalidate = 3600 // ISR: revalidate every hour. Edit this comment to force a fresh build.

const WHATSAPP_URL = 'https://wa.me/15014438478'

export const metadata: Metadata = {
  title: 'Gift Ideas That People Actually Want | Giftist',
  description: 'Curated gift recommendations backed by Wirecutter, The Strategist, Reddit, and real reviews. Find the perfect gift for anyone.',
  openGraph: {
    title: 'Gift Ideas That People Actually Want | Giftist',
    description: 'Curated gift recommendations backed by Wirecutter, The Strategist, Reddit, and real reviews.',
    url: 'https://giftist.ai/shop',
    type: 'website',
  },
  alternates: { canonical: 'https://giftist.ai/shop' },
}

async function getGifts(): Promise<{ editorsPicks: GiftProduct[]; allGifts: GiftProduct[] }> {
  const products = await prisma.tastemakerGift.findMany({
    where: {
      reviewStatus: 'approved',
    },
    orderBy: { totalScore: 'desc' },
    select: {
      id: true,
      name: true,
      price: true,
      priceValue: true,
      image: true,
      url: true,
      domain: true,
      why: true,
      totalScore: true,
      signalCount: true,
      sources: true,
      recipientTypes: true,
      occasions: true,
      interests: true,
      priceRange: true,
    },
  })

  // Create tracked links for ALL products with URLs so every click
  // routes through /r/SLUG (opens retailer in bg + lands on Giftist /p page).
  // Parallel batches keep build time reasonable.
  const withSlugs: GiftProduct[] = []
  const productsWithUrls = products.filter(p => p.url)
  const slugMap = new Map<string, string>()
  const CONCURRENCY = 12

  let cursor = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < productsWithUrls.length) {
        const p = productsWithUrls[cursor++]
        try {
          const trackedUrl = await createTrackedLink({
            productName: p.name,
            targetUrl: p.url!,
            price: p.price,
            priceValue: p.priceValue,
            image: p.image,
            source: 'GIFTS_PAGE',
          })
          slugMap.set(p.id, trackedUrl.split('/p/')[1])
        } catch {}
      }
    })
  )

  for (const p of products) {
    withSlugs.push({ ...p, trackedSlug: slugMap.get(p.id) })
  }

  // Editor's Picks pool — blends three signals so the carousel changes daily,
  // surfaces what's actually getting clicked, AND keeps discovery via a
  // daily-seeded random sample of the top-60.
  //
  // Excluded from the carousel only (still appear in the grid below):
  // mugs, massagers, and headphones — overrepresented + low-emotion-gift signal.
  // Sentinel slugs (shop-hero-wa, shop-sticky-wa) also excluded from clicks.
  const CAROUSEL_EXCLUDE = /\b(mug|massager|theragun|headphones?|earbuds?|airpods)\b/i
  const withImages = withSlugs.filter(p => p.image && !CAROUSEL_EXCLUDE.test(p.name))

  // Pull last-7d click counts per slug → map back to TastemakerGift via productName
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const clickRows = await prisma.$queryRaw<{ productName: string; clicks: bigint }[]>`
    SELECT pc."productName", COUNT(ce.id) as clicks
    FROM "ProductClick" pc
    JOIN "ClickEvent" ce ON ce.slug = pc.slug
    WHERE ce."createdAt" >= ${since}
      AND ce.event IN ('CARD_CLICK', 'RETAILER_CLICK', 'WA_INTENT')
      AND pc.slug NOT IN ('shop-hero-wa', 'shop-sticky-wa')
    GROUP BY pc."productName"
    ORDER BY clicks DESC
    LIMIT 30
  `
  const clickMap = new Map<string, number>(clickRows.map(r => [r.productName, Number(r.clicks)]))

  // Daily seed (PT-anchored). Same day → same carousel. Next day → fresh shuffle.
  const dayInPT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const seed = dayInPT.getFullYear() * 10000 + (dayInPT.getMonth() + 1) * 100 + dayInPT.getDate()
  function seededShuffle<T>(arr: T[], s: number): T[] {
    const a = [...arr]
    let rng = s
    for (let i = a.length - 1; i > 0; i--) {
      rng = (rng * 9301 + 49297) % 233280
      const j = Math.floor((rng / 233280) * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const seen = new Set<string>()
  // 1. Top by clicks (proven engagement) — up to 3
  const clicked = withImages
    .filter(p => clickMap.has(p.name))
    .sort((a, b) => (clickMap.get(b.name) || 0) - (clickMap.get(a.name) || 0))
    .slice(0, 3)
  for (const p of clicked) seen.add(p.id)

  // 2. Books — daily-shuffled top picks
  const books = seededShuffle(
    withImages.filter(p => p.interests?.includes('reading') && !seen.has(p.id)).slice(0, 8),
    seed,
  ).slice(0, 2)
  for (const p of books) seen.add(p.id)

  // 3. Mother's Day picks — daily-shuffled
  const seasonal = seededShuffle(
    withImages.filter(p => p.occasions?.includes('mothers-day') && !seen.has(p.id)).slice(0, 8),
    seed + 1,
  ).slice(0, 2)
  for (const p of seasonal) seen.add(p.id)

  // 4. Discovery — daily-seeded random pick from top-60 by score
  const discoveryPool = withImages.filter(p => !seen.has(p.id)).slice(0, 60)
  const discovery = seededShuffle(discoveryPool, seed + 2).slice(0, 4)
  for (const p of discovery) seen.add(p.id)

  // Interleave: clicked, book, MD, discovery — so the strip feels mixed.
  const buckets = [clicked, books, seasonal, discovery]
  const editorsPicks: GiftProduct[] = []
  let idx = 0
  while (editorsPicks.length < 9 && buckets.some(b => b.length > 0)) {
    const b = buckets[idx % buckets.length]
    if (b.length > 0) editorsPicks.push(b.shift()!)
    idx++
  }

  return {
    editorsPicks,
    allGifts: withSlugs,
  }
}

export default async function ShopPage() {
  const { editorsPicks, allGifts } = await getGifts()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Gift Ideas That People Actually Want',
    description: 'Curated gift recommendations backed by expert reviews and real data.',
    url: 'https://giftist.ai/shop',
    provider: { '@type': 'Organization', name: 'Giftist', url: 'https://giftist.ai' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: allGifts.length,
      itemListElement: allGifts.slice(0, 50).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: p.name,
          description: p.why || `Curated gift recommendation`,
          ...(p.image ? { image: p.image } : {}),
          ...(p.url ? { url: `https://giftist.ai/p/${p.trackedSlug || ''}` } : {}),
          ...(p.priceValue ? {
            offers: {
              '@type': 'Offer',
              price: p.priceValue,
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
            },
          } : {}),
          ...(p.totalScore >= 2 ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Math.min(5, Math.round(p.totalScore * 1.5 * 10) / 10),
              bestRating: 5,
              ratingCount: p.signalCount,
            },
          } : {}),
        },
      })),
    },
  }

  return (
    <div className="min-h-screen bg-white">
      <ShopPageViewTracker path="/shop" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">The Giftist</span>
          </Link>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("I need help finding a gift")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#20bd5a] transition"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Ask Concierge
          </a>
        </div>
      </nav>

      {/* Occasion-aware hero — swaps to a Mother's Day variant when arriving via
          ?occasion=mothers-day or utm_campaign=md-* */}
      <Suspense fallback={
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-8">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Gifts people actually want
            </h1>
            <p className="text-gray-500 mt-3 text-base sm:text-lg leading-relaxed">
              Every pick is backed by expert reviews from Wirecutter, The Strategist, Reddit, and real purchase data.
            </p>
          </div>
        </div>
      }>
        <ShopHero />
      </Suspense>

      {/* Editor's Picks — auto-playing carousel of top picks */}
      {editorsPicks.length > 0 && (
        <PicksCarousel picks={editorsPicks} />
      )}

      {/* Inline CTA */}
      <div className="bg-gray-50 border-y border-gray-100 py-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-600 leading-relaxed">
            Can&apos;t find the right thing? Tell me about the person — their hobbies, age, your budget — and I&apos;ll find something perfect.
          </p>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("I need help finding a gift for someone special")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-gray-800 transition"
          >
            <MessageCircle className="h-4 w-4" />
            Get personalized picks
          </a>
        </div>
      </div>

      {/* Filter + Grid — Client Component but server-renders all cards (no useSearchParams,
          uses window.location post-hydration to apply URL filters). */}
      <div id="all-gifts">
        <GiftGrid gifts={allGifts} />
      </div>

      {/* Sticky bottom WhatsApp CTA — mobile only, hides on lg+ */}
      <Suspense fallback={null}>
        <StickyConciergeBar />
      </Suspense>

      {/* Bottom CTA */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold">Still looking?</h2>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            I&apos;ve helped 2,400+ people find the perfect gift. Tell me who you&apos;re shopping for and I&apos;ll do the rest.
          </p>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("I need help finding a gift")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 bg-[#25D366] text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-[#20bd5a] transition"
          >
            <MessageCircle className="h-4 w-4" />
            Chat with Giftist on WhatsApp
          </a>
          <p className="text-gray-500 text-xs mt-3">Free to try &middot; No app needed &middot; Powered by AI</p>
        </div>
      </div>
    </div>
  )
}
