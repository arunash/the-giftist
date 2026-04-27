'use client'

import { useState, useMemo, useEffect } from 'react'
import { Gift, ExternalLink, MessageCircle, ChevronRight } from 'lucide-react'
import { trackClick, buildRetailerHref } from '@/lib/track-click'
import { ProductModal } from './product-modal'

const WHATSAPP_URL = 'https://wa.me/15014438478'

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
  const entries = Object.entries(sources) as [string, any][]
  if (entries.length === 0) return null
  entries.sort((a, b) => (b[1]?.weight || 0) - (a[1]?.weight || 0))
  const topSource = entries[0][0]
  return SOURCE_LABELS[topSource] || { label: 'Expert Pick', color: 'bg-gray-50 text-gray-600' }
}

// Compact "Wirecutter · NY Mag · Reddit" line — used as a trust strip below
// the title when ≥2 sources back the product.
function getSourceStack(sources: any): string[] {
  if (!sources || typeof sources !== 'object') return []
  const SHORT: Record<string, string> = {
    wirecutter: 'Wirecutter',
    strategist: 'NY Mag',
    oprah_daily: 'Oprah',
    reddit_occasions: 'Reddit',
    uncommon_goods: 'Uncommon Goods',
    something_good_blog: 'Something Good',
    amazon_bestseller: 'Amazon',
    etsy_trending: 'Etsy',
  }
  return Object.keys(sources)
    .map(k => SHORT[k])
    .filter((x): x is string => !!x)
    .slice(0, 3)
}

const OCCASIONS = [
  { key: 'all', label: 'All' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'mothers-day', label: "Mother's Day" },
  { key: 'fathers-day', label: "Father's Day" },
  { key: 'christmas', label: 'Christmas' },
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'wedding', label: 'Wedding' },
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

// Category filter — backed by the `interests` tag on TastemakerGift.
// 'books' is mapped to the 'reading' interest tag (187 products).
const CATEGORIES = [
  { key: 'all',      label: 'All Categories' },
  { key: 'books',    label: '📚 Books',      tag: 'reading' },
  { key: 'home',     label: '🏠 Home',       tag: 'home' },
  { key: 'fashion',  label: '👗 Fashion',    tag: 'fashion' },
  { key: 'tech',     label: '💻 Tech',       tag: 'tech' },
  { key: 'cooking',  label: '🍳 Cooking',    tag: 'cooking' },
  { key: 'beauty',   label: '✨ Beauty',     tag: 'beauty' },
  { key: 'travel',   label: '✈️ Travel',     tag: 'travel' },
  { key: 'art',      label: '🎨 Art',        tag: 'art' },
  { key: 'outdoor',  label: '🏕️ Outdoor',   tag: 'outdoor' },
  { key: 'fitness',  label: '💪 Fitness',    tag: 'fitness' },
  { key: 'music',    label: '🎵 Music',      tag: 'music' },
  { key: 'wellness', label: '🧘 Wellness',   tag: 'wellness' },
]

export interface GiftProduct {
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

function matchesPriceRange(product: GiftProduct, filter: string): boolean {
  if (filter === 'all') return true
  // Use priceRange field if available, fall back to priceValue
  if (product.priceRange) return product.priceRange === filter
  if (!product.priceValue) return false
  switch (filter) {
    case 'budget': return product.priceValue < 30
    case 'mid': return product.priceValue >= 30 && product.priceValue <= 75
    case 'premium': return product.priceValue > 75 && product.priceValue <= 150
    case 'luxury': return product.priceValue > 150
    default: return true
  }
}

function isValidKey(value: string | null, options: Array<{ key: string }>): string {
  if (!value) return 'all'
  return options.some(o => o.key === value) ? value : 'all'
}

export function GiftGrid({ gifts }: { gifts: GiftProduct[] }) {
  // Default to 'all' on server-render so the full catalog is visible in
  // the initial HTML (good for SEO and for users with JS slow/disabled).
  // After hydration, useEffect reads URL params and applies the filter.
  // This avoids needing useSearchParams + Suspense, which would render the
  // grid as null during SSR.
  const [occasion, setOccasion] = useState('all')
  const [recipient, setRecipient] = useState('all')
  const [priceRange, setPriceRange] = useState('all')
  const [category, setCategory] = useState('all')
  const [activeProduct, setActiveProduct] = useState<GiftProduct | null>(null)

  // Hydrate filter state from URL after mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setOccasion(isValidKey(params.get('occasion'), OCCASIONS))
    setRecipient(isValidKey(params.get('recipient'), RECIPIENTS))
    setPriceRange(isValidKey(params.get('price'), PRICE_RANGES))
    setCategory(isValidKey(params.get('category'), CATEGORIES))
  }, [])

  // Keep URL in sync when user changes filters (preserve other params like utm_*).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (occasion === 'all') params.delete('occasion'); else params.set('occasion', occasion)
    if (recipient === 'all') params.delete('recipient'); else params.set('recipient', recipient)
    if (priceRange === 'all') params.delete('price'); else params.set('price', priceRange)
    if (category === 'all') params.delete('category'); else params.set('category', category)
    const qs = params.toString()
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [occasion, recipient, priceRange, category])

  const filtered = useMemo(() => {
    return gifts.filter(p => {
      if (occasion !== 'all' && !p.occasions?.includes(occasion)) return false
      if (recipient !== 'all') {
        const types = p.recipientTypes || []
        if (!types.includes(recipient) && !types.includes('universal')) return false
      }
      if (!matchesPriceRange(p, priceRange)) return false
      if (category !== 'all') {
        const cat = CATEGORIES.find(c => c.key === category)
        if (cat?.tag && !p.interests?.includes(cat.tag)) return false
      }
      return true
    })
  }, [gifts, occasion, recipient, priceRange, category])

  const hasActiveFilter = occasion !== 'all' || recipient !== 'all' || priceRange !== 'all' || category !== 'all'

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-lg font-bold text-gray-900 mb-2">All Gifts</h2>
      <p className="text-sm text-gray-400 mb-5">
        {hasActiveFilter ? `${filtered.length} of ${gifts.length}` : gifts.length} curated picks from trusted sources
      </p>

      {/* Category pills (Books, Tech, Cooking, etc.) */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">Category</p>
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                category === c.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Occasion pills */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">Occasion</p>
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {OCCASIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setOccasion(o.key)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                occasion === o.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient pills */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">For</p>
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {RECIPIENTS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRecipient(r.key)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                recipient === r.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price range pills */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">Budget</p>
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {PRICE_RANGES.map((pr) => (
            <button
              key={pr.key}
              onClick={() => setPriceRange(pr.key)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                priceRange === pr.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear filters */}
      {hasActiveFilter && (
        <button
          onClick={() => { setOccasion('all'); setRecipient('all'); setPriceRange('all'); setCategory('all') }}
          className="text-xs text-pink-500 font-medium mb-4 hover:underline"
        >
          Clear all filters
        </button>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Gift className="h-10 w-10 text-gray-200 mx-auto" />
          <p className="text-sm text-gray-400 mt-3">No gifts match these filters.</p>
          <button
            onClick={() => { setOccasion('all'); setRecipient('all'); setPriceRange('all'); setCategory('all') }}
            className="text-sm font-semibold text-pink-500 mt-2 hover:underline"
          >
            Clear filters
          </button>
          <div className="mt-4">
            <a
              href={`${WHATSAPP_URL}?text=${encodeURIComponent("I need help finding a gift")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#25D366] hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              Ask our concierge instead
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((p) => (
            <GiftCard key={p.id} product={p} onOpen={() => setActiveProduct(p)} />
          ))}
        </div>
      )}

      {/* Click-to-preview modal */}
      <ProductModal product={activeProduct} onClose={() => setActiveProduct(null)} />
    </section>
  )
}

function GiftCard({ product: p, onOpen }: { product: GiftProduct; onOpen: () => void }) {
  const [imgError, setImgError] = useState(false)
  const badge = getSourceBadge(p.sources)
  const sourceStack = getSourceStack(p.sources)
  const giftistUrl = p.trackedSlug ? `/p/${p.trackedSlug}` : null
  const retailerUrl = p.trackedSlug ? `/go-r/${p.trackedSlug}` : p.url
  const waLink = `${WHATSAPP_URL}?text=${encodeURIComponent(`Tell me more about the ${p.name}`)}`

  // Card body click → open the in-page details modal (no navigation, no
  // popup-blocker, no losing scroll position). Cmd/Ctrl/middle-click still
  // opens /p/SLUG in a new tab using the underlying anchor href.
  const handleCardClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0) return
    e.preventDefault()
    if (p.trackedSlug) trackClick(p.trackedSlug, 'CARD_CLICK', 'WEB')
    onOpen()
  }

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all duration-200">
      <a
        href={giftistUrl || retailerUrl || waLink}
        onClick={handleCardClick}
        className="block cursor-pointer"
        {...(!giftistUrl && !retailerUrl ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
          {p.image && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image}
              alt={p.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100">
              <Gift className="h-6 w-6 text-gray-300 mb-2" />
              <p className="text-[11px] text-gray-400 text-center leading-tight line-clamp-3 font-medium">{p.name}</p>
            </div>
          )}

          {p.price && (
            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-900 px-2 py-0.5 rounded-full shadow-sm">
              {p.price}
            </div>
          )}

          {badge && (
            <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ring-1 ring-black/5 ${badge.color}`}>
              {badge.label}
            </div>
          )}

          {p.occasions?.includes('mothers-day') && (
            <div className="absolute bottom-2 left-2 bg-pink-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
              <span>🌸</span> Mother&apos;s Day
            </div>
          )}
        </div>
      </a>

      <div className="p-3">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
          {p.domain?.replace('www.', '') || 'Shop'}
        </p>
        <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5 line-clamp-2">
          {p.name}
        </p>

        {/* Trust strip — surfaces the stacked-expert-source signal that's
            otherwise hidden in a corner chip. Renders only when ≥2 sources. */}
        {sourceStack.length >= 2 && (
          <p className="text-[10px] text-gray-500 mt-1 leading-snug font-medium">
            <span className="text-amber-500">★</span>{' '}
            {sourceStack.join(' · ')}
            {p.signalCount > sourceStack.length && (
              <span className="text-gray-400"> +{p.signalCount - sourceStack.length} more</span>
            )}
          </p>
        )}

        {p.why && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-snug">
            {p.why}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2.5">
          {giftistUrl && retailerUrl ? (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (p.trackedSlug) trackClick(p.trackedSlug, 'CARD_CLICK', 'WEB'); onOpen() }}
                className="flex items-center gap-1 text-[11px] font-semibold text-pink-500 hover:text-pink-600 transition"
              >
                Details
              </button>
              <a
                href={retailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0) return
                  if (!p.trackedSlug) return
                  e.preventDefault()
                  window.open(buildRetailerHref(p.trackedSlug), '_blank', 'noopener,noreferrer')
                }}
                className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-700 hover:text-gray-900 transition"
                aria-label={`Buy on ${p.domain?.replace('www.', '') || 'retailer'}`}
              >
                Buy
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </>
          ) : retailerUrl ? (
            <a
              href={retailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-pink-500 hover:text-pink-600 transition"
            >
              Buy
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-[#25D366] hover:text-[#20bd5a] transition"
            >
              Ask about this
              <MessageCircle className="h-2.5 w-2.5" />
            </a>
          )}
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Find me something similar to ${p.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition ml-auto"
          >
            Find similar
            <ChevronRight className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
