'use client'

import { ExternalLink, Gift } from 'lucide-react'
import { trackClick, buildRetailerHref } from '@/lib/track-click'

interface Pick {
  id: string
  name: string
  price: string | null
  image: string | null
  domain: string | null
  why: string | null
  trackedSlug?: string
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  wirecutter:        { label: 'Wirecutter Pick',  color: 'bg-blue-50 text-blue-700' },
  strategist:        { label: 'NY Mag Pick',       color: 'bg-purple-50 text-purple-700' },
  oprah_daily:       { label: "Oprah's Pick",      color: 'bg-orange-50 text-orange-700' },
  uncommon_goods:    { label: 'Top Seller',        color: 'bg-emerald-50 text-emerald-700' },
  amazon_bestseller: { label: 'Bestseller',        color: 'bg-amber-50 text-amber-700' },
  etsy_trending:     { label: 'Trending',          color: 'bg-pink-50 text-pink-700' },
  reddit_occasions:  { label: 'Reddit Loved',      color: 'bg-red-50 text-red-700' },
}

export function ListicleCard({ pick: p, index }: { pick: any; index: number }) {
  const giftUrl = p.trackedSlug ? `/p/${p.trackedSlug}` : null
  const buyUrl  = p.trackedSlug ? `/go-r/${p.trackedSlug}` : p.url

  const handleBuy = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0) return
    if (!p.trackedSlug) return
    e.preventDefault()
    window.open(buildRetailerHref(p.trackedSlug), '_blank', 'noopener,noreferrer')
  }

  // Top source for the trust chip
  let badge: { label: string; color: string } | null = null
  if (p.sources && typeof p.sources === 'object') {
    const entries = Object.entries(p.sources) as [string, any][]
    if (entries.length > 0) {
      entries.sort((a, b) => (b[1]?.weight || 0) - (a[1]?.weight || 0))
      badge = SOURCE_LABELS[entries[0][0]] || null
    }
  }

  return (
    <div className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row">
        {/* Image — square on mobile (full width), tall on desktop */}
        {p.image && (
          <a
            href={giftUrl || buyUrl || '#'}
            onClick={() => p.trackedSlug && trackClick(p.trackedSlug, 'CARD_CLICK', 'WEB')}
            className="block sm:w-56 sm:flex-shrink-0 aspect-square sm:aspect-auto bg-gray-50 overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image}
              alt={p.name}
              loading={index <= 3 ? 'eager' : 'lazy'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </a>
        )}

        <div className="flex-1 p-5 sm:p-6">
          {/* Numbered eyebrow + source badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-serif text-xl text-pink-500 font-bold tabular-nums">
              {index < 10 ? `0${index}` : index}
            </span>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.label}
              </span>
            )}
            {p.price && (
              <span className="text-xs text-gray-500 font-medium ml-auto">
                {p.price}
              </span>
            )}
          </div>

          {/* Name */}
          <h2 className="font-serif text-lg sm:text-xl text-gray-900 leading-tight mb-2">
            {p.name}
          </h2>

          {/* Why */}
          {p.why && (
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {p.why}
            </p>
          )}

          {/* CTA pair — Gift via Giftist primary, View on retailer secondary */}
          <div className="flex flex-col sm:flex-row gap-2">
            {giftUrl && (
              <a
                href={giftUrl}
                onClick={() => p.trackedSlug && trackClick(p.trackedSlug, 'CARD_CLICK', 'WEB')}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-pink-500 text-white rounded-xl font-semibold text-xs hover:bg-pink-600 transition"
              >
                <Gift className="h-3.5 w-3.5" />
                Gift via Giftist
              </a>
            )}
            {buyUrl && (
              <a
                href={buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleBuy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-xs hover:border-gray-300 hover:bg-gray-50 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on {p.domain?.replace(/^www\./, '') || 'retailer'}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
