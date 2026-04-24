'use client'

import { useState, useMemo } from 'react'
import { Gift, ExternalLink, MessageCircle, ChevronRight } from 'lucide-react'

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

export function GiftGrid({ gifts }: { gifts: GiftProduct[] }) {
  const [occasion, setOccasion] = useState('all')
  const [recipient, setRecipient] = useState('all')
  const [priceRange, setPriceRange] = useState('all')

  const filtered = useMemo(() => {
    return gifts.filter(p => {
      if (occasion !== 'all' && !p.occasions?.includes(occasion)) return false
      if (recipient !== 'all') {
        const types = p.recipientTypes || []
        if (!types.includes(recipient) && !types.includes('universal')) return false
      }
      if (!matchesPriceRange(p, priceRange)) return false
      return true
    })
  }, [gifts, occasion, recipient, priceRange])

  const hasActiveFilter = occasion !== 'all' || recipient !== 'all' || priceRange !== 'all'

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-lg font-bold text-gray-900 mb-2">All Gifts</h2>
      <p className="text-sm text-gray-400 mb-5">
        {hasActiveFilter ? `${filtered.length} of ${gifts.length}` : gifts.length} curated picks from trusted sources
      </p>

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
          onClick={() => { setOccasion('all'); setRecipient('all'); setPriceRange('all') }}
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
            onClick={() => { setOccasion('all'); setRecipient('all'); setPriceRange('all') }}
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
            <GiftCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  )
}

function GiftCard({ product: p }: { product: GiftProduct }) {
  const [imgError, setImgError] = useState(false)
  const badge = getSourceBadge(p.sources)
  const retailerUrl = p.trackedSlug ? `/go-r/${p.trackedSlug}` : p.url
  const giftistUrl = p.trackedSlug ? `/p/${p.trackedSlug}` : null

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all duration-200">
      <a href={giftistUrl || retailerUrl || '#'} className="block">
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
            <div className="w-full h-full flex items-center justify-center">
              <Gift className="h-8 w-8 text-gray-200" />
            </div>
          )}

          {p.price && (
            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-900 px-2 py-0.5 rounded-full shadow-sm">
              {p.price}
            </div>
          )}

          {badge && (
            <div className={`absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
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

        {p.why && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-snug">
            {p.why}
          </p>
        )}

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
