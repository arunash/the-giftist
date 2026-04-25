'use client'

import { useState } from 'react'
import { Gift, ExternalLink, ChevronRight } from 'lucide-react'
import { GiftProduct } from './gift-grid'

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

export function EditorsPickCard({ product: p }: { product: GiftProduct }) {
  const [imgError, setImgError] = useState(false)
  const badge = getSourceBadge(p.sources)
  const giftistUrl = p.trackedSlug ? `/p/${p.trackedSlug}` : null
  const retailerUrl = p.trackedSlug ? `/go-r/${p.trackedSlug}` : p.url

  // Single-tab — navigates current tab to /p/SLUG (popup blocker friction was
  // hurting conversion on mobile per funnel data). Retailer is on the product
  // page itself.
  const dualClick = giftistUrl
    ? (e: React.MouseEvent) => {
        if (p.trackedSlug && !(e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0)) {
          fetch('/api/analytics/click-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: p.trackedSlug, event: 'CARD_CLICK', channel: 'WEB' }),
            keepalive: true,
          }).catch(() => {})
        }
      }
    : undefined

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all duration-200">
      <a href={giftistUrl || retailerUrl || '#'} onClick={dualClick} className="block" {...(!giftistUrl && retailerUrl ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
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

        {p.why && (
          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-snug">
            {p.why}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2.5">
          {giftistUrl && retailerUrl ? (
            <a
              href={giftistUrl}
              onClick={dualClick}
              className="flex items-center gap-1 text-[11px] font-semibold text-pink-500 hover:text-pink-600 transition"
            >
              Buy
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : retailerUrl && (
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
