import { prisma } from '@/lib/db'
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Gift, ExternalLink, MessageCircle, Star, ChevronRight, Search } from 'lucide-react'
import { createTrackedLink } from '@/lib/product-link'

export const revalidate = 3600 // ISR: revalidate every hour

const WHATSAPP_URL = 'https://wa.me/15014438478'

// Map source keys to display labels
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  wirecutter: { label: 'Wirecutter Pick', color: 'bg-blue-50 text-blue-700' },
  strategist: { label: 'NY Mag Pick', color: 'bg-purple-50 text-purple-700' },
  oprah_daily: { label: "Oprah's Pick", color: 'bg-orange-50 text-orange-700' },
  reddit_occasions: { label: 'Reddit Loved', color: 'bg-red-50 text-red-700' },
  uncommon_goods: { label: 'Top Seller', color: 'bg-green-50 text-green-700' },
  something_good_blog: { label: 'Editor Pick', color: 'bg-teal-50 text-teal-700' },
  amazon_bestseller: { label: 'Bestseller', color: 'bg-yellow-50 text-yellow-700' },
  etsy_trending: { label: 'Trending', color: 'bg-pink-50 text-pink-700' },
}

function getSourceBadge(sources: any): { label: string; color: string } | null {
  if (!sources || typeof sources !== 'object') return null
  // Pick the highest-weight source
  const entries = Object.entries(sources) as [string, any][]
  if (entries.length === 0) return null
  entries.sort((a, b) => (b[1]?.weight || 0) - (a[1]?.weight || 0))
  const topSource = entries[0][0]
  return SOURCE_LABELS[topSource] || { label: 'Expert Pick', color: 'bg-gray-50 text-gray-600' }
}

// Occasion filter labels
const OCCASIONS = [
  { key: 'all', label: 'All Gifts' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'mothers-day', label: "Mother's Day" },
  { key: 'fathers-day', label: "Father's Day" },
  { key: 'christmas', label: 'Christmas' },
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'wedding', label: 'Wedding' },
  { key: 'graduation', label: 'Graduation' },
  { key: 'just-because', label: 'Just Because' },
]

const RECIPIENTS = [
  { key: 'all', label: 'Anyone' },
  { key: 'mom', label: 'Mom' },
  { key: 'dad', label: 'Dad' },
  { key: 'partner', label: 'Partner' },
  { key: 'friend', label: 'Friend' },
  { key: 'coworker', label: 'Coworker' },
  { key: 'self', label: 'Self' },
]

const PRICE_RANGES = [
  { key: 'all', label: 'Any Price' },
  { key: 'budget', label: 'Under $30' },
  { key: 'mid', label: '$30 - $75' },
  { key: 'premium', label: '$75 - $150' },
  { key: 'luxury', label: '$150+' },
]

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

interface GiftProduct {
  id: string
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  url: string | null
  domain: string | null
  why: string | null
  totalScore: number
  signalCount: number
  sources: any
  recipientTypes: string[]
  occasions: string[]
  interests: string[]
  priceRange: string
  trackedSlug?: string
}

async function getGifts(): Promise<{ editorsPicks: GiftProduct[]; allGifts: GiftProduct[] }> {
  const products = await prisma.tastemakerGift.findMany({
    where: {
      reviewStatus: 'approved',
      image: { not: null },
      url: { not: null },
    },
    orderBy: { totalScore: 'desc' },
    take: 200,
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

  // Create tracked links for all products
  const withSlugs: GiftProduct[] = []
  for (const p of products) {
    let trackedSlug: string | undefined
    if (p.url) {
      try {
        const trackedUrl = await createTrackedLink({
          productName: p.name,
          targetUrl: p.url,
          price: p.price,
          priceValue: p.priceValue,
          image: p.image,
          source: 'GIFTS_PAGE',
        })
        // Extract slug from URL: https://giftist.ai/p/SLUG
        trackedSlug = trackedUrl.split('/p/')[1]
      } catch {}
    }
    withSlugs.push({ ...p, trackedSlug })
  }

  return {
    editorsPicks: withSlugs.slice(0, 6),
    allGifts: withSlugs,
  }
}

export default async function GiftsPage() {
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

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-8">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Gifts people actually want
          </h1>
          <p className="text-gray-500 mt-3 text-base sm:text-lg leading-relaxed">
            Every pick is backed by expert reviews from Wirecutter, The Strategist, Reddit, and real purchase data. No filler, no generic candles.
          </p>
        </div>
      </div>

      {/* Editor's Picks */}
      {editorsPicks.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <div className="flex items-center gap-2 mb-5">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <h2 className="text-lg font-bold text-gray-900">Editor&apos;s Picks</h2>
            <span className="text-xs text-gray-400 ml-1">Highest-rated across all signals</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {editorsPicks.map((p) => (
              <GiftCard key={p.id} product={p} featured />
            ))}
          </div>
        </section>
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

      {/* Filter + Grid */}
      <GiftGrid gifts={allGifts} />

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

function GiftCard({ product: p, featured }: { product: GiftProduct; featured?: boolean }) {
  const badge = getSourceBadge(p.sources)
  const retailerUrl = p.trackedSlug ? `/go-r/${p.trackedSlug}` : p.url
  const giftistUrl = p.trackedSlug ? `/p/${p.trackedSlug}` : null

  // Image links to Giftist product page (shows why + details)
  // "Buy" button links to retailer (affiliate) in new tab
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all duration-200">
      {/* Product image — click opens Giftist product page with details */}
      <a
        href={giftistUrl || retailerUrl || '#'}
        className="block"
      >
        <div className={`relative ${featured ? 'aspect-square' : 'aspect-[4/5]'} bg-gray-50 overflow-hidden`}>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image}
              alt={p.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gift className="h-8 w-8 text-gray-200" />
            </div>
          )}

          {/* Price badge */}
          {p.price && (
            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-900 px-2 py-0.5 rounded-full shadow-sm">
              {p.price}
            </div>
          )}

          {/* Source badge */}
          {badge && (
            <div className={`absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
            </div>
          )}
        </div>
      </a>

      {/* Product info */}
      <div className="p-3">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
          {p.domain?.replace('www.', '') || 'Shop'}
        </p>
        <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5 line-clamp-2">
          {p.name}
        </p>

        {/* Why — shown as a subtle teaser */}
        {p.why && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-snug">
            {p.why}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2.5">
          {retailerUrl && (
            <a
              href={retailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-pink-500 hover:text-pink-600 transition"
            >
              Buy
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          {p.trackedSlug && (
            <a
              href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Tell me more about the ${p.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition ml-auto"
            >
              Find similar
              <ChevronRight className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function GiftGrid({ gifts }: { gifts: GiftProduct[] }) {
  // Server-rendered grid with all products — filtering happens client-side via CSS/JS
  // For now, render all products; we'll add client-side filtering in a follow-up
  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-lg font-bold text-gray-900 mb-2">All Gifts</h2>
      <p className="text-sm text-gray-400 mb-6">{gifts.length} curated picks from trusted sources</p>

      {/* Filter pills — static for now, can be made interactive with client component */}
      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
        {OCCASIONS.slice(0, 6).map((o) => (
          <span
            key={o.key}
            className="flex-shrink-0 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full cursor-default"
          >
            {o.label}
          </span>
        ))}
      </div>

      {gifts.length === 0 ? (
        <div className="text-center py-20">
          <Gift className="h-10 w-10 text-gray-200 mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Products are being curated. Check back soon!</p>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("I need help finding a gift")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-[#25D366] hover:underline"
          >
            <MessageCircle className="h-4 w-4" />
            Ask our concierge instead
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {gifts.map((p) => (
            <GiftCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  )
}
