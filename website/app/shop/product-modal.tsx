'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ExternalLink, MessageCircle, Sparkles, ShieldCheck, Star, Gift } from 'lucide-react'
import { trackClick, buildRetailerHref } from '@/lib/track-click'
import type { GiftProduct } from './gift-grid'

const WHATSAPP_URL = 'https://wa.me/15014438478'

const SOURCE_LABELS: Record<string, string> = {
  wirecutter: 'Wirecutter',
  strategist: 'NY Mag Strategist',
  oprah_daily: "Oprah Daily",
  reddit_occasions: 'Reddit',
  uncommon_goods: 'Uncommon Goods',
  something_good_blog: 'Something Good',
  amazon_bestseller: 'Amazon Bestsellers',
  etsy_trending: 'Etsy Trending',
}

function getSourceList(sources: any): string[] {
  if (!sources || typeof sources !== 'object') return []
  return Object.keys(sources)
    .map(k => SOURCE_LABELS[k] || null)
    .filter((x): x is string => !!x)
    .slice(0, 4)
}

export function ProductModal({
  product,
  onClose,
}: {
  product: GiftProduct | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [imgError, setImgError] = useState(false)

  // ESC closes; lock body scroll while open
  useEffect(() => {
    if (!product) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [product, onClose])

  if (!product) return null

  const sources = getSourceList(product.sources)
  const slug = product.trackedSlug
  const retailerHostname = product.domain?.replace(/^www\./, '') || 'retailer'
  const waText = `Hi! I'm interested in "${product.name}"${product.price ? ` (${product.price})` : ''}. Can you tell me more?`
  const waHref = `${WHATSAPP_URL}?text=${encodeURIComponent(waText)}`

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl my-0 sm:my-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-white/95 backdrop-blur-sm text-gray-700 hover:bg-white shadow-md transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Image */}
        <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          {product.image && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center px-6">
              <Gift className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 text-center font-medium line-clamp-3">{product.name}</p>
            </div>
          )}
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 bg-white/95 backdrop-blur-sm text-gray-900 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
            <Sparkles className="h-3 w-3 text-amber-500" />
            Picked by Giftist
          </div>
          {product.occasions?.includes('fathers-day') && (
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-sky-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              🎩 Father&apos;s Day
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Title + price + retailer */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              {retailerHostname}
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight mt-1">
              {product.name}
            </h2>
            {product.price && (
              <p className="text-2xl font-bold text-gray-900 mt-2">{product.price}</p>
            )}
          </div>

          {/* Why this is a good gift */}
          {product.why && (
            <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-100">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1.5">Why this is a good gift</p>
              <p className="text-sm text-gray-800 leading-relaxed">{product.why}</p>
            </div>
          )}

          {/* Sources / proof */}
          {sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Featured by</p>
              {sources.map((s) => (
                <span key={s} className="inline-flex items-center text-[10px] font-medium text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Trust signals */}
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center gap-2 text-gray-700">
              <ShieldCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Verified price from {retailerHostname}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Star className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>Highly rated by verified buyers</span>
            </div>
          </div>

          {/* CTAs — priority: Gift via Giftist > View on retailer > WhatsApp help.
              Gifting through Giftist (the /p/SLUG page) is our primary monetization
              path: it captures recipient info, handles checkout, and creates a
              shareable gift. Direct retailer buy is the fallback for users who
              just want to buy for themselves. */}
          <div className="space-y-2.5 pt-1">
            {slug && (
              <a
                href={`/p/${slug}`}
                onClick={() => trackClick(slug, 'CARD_CLICK', 'WEB')}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-pink-500 text-white rounded-xl font-semibold text-sm hover:bg-pink-600 transition shadow-md shadow-pink-500/30"
              >
                <Gift className="h-4 w-4" />
                Gift via Giftist
              </a>
            )}

            {slug && (
              <a
                href={`/go-r/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0) return
                  e.preventDefault()
                  window.open(buildRetailerHref(slug), '_blank', 'noopener,noreferrer')
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition"
              >
                <ExternalLink className="h-4 w-4" />
                View on {retailerHostname}
              </a>
            )}

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => slug && trackClick(slug, 'WA_INTENT', 'WEB')}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#25D366] hover:text-[#20bd5a] transition"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Need help? Chat with our concierge
            </a>

          </div>
        </div>
      </div>
    </div>
  )
}
