'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Sparkles, ExternalLink, BookOpen, Heart, Star } from 'lucide-react'
import { trackClick, buildRetailerHref } from '@/lib/track-click'
import type { GiftProduct } from './gift-grid'
import { ProductModal } from './product-modal'

const ROTATE_MS = 5000

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  wirecutter:        { label: 'Wirecutter',    color: 'bg-blue-100 text-blue-800' },
  strategist:        { label: 'NY Mag',         color: 'bg-purple-100 text-purple-800' },
  oprah_daily:       { label: "Oprah",          color: 'bg-orange-100 text-orange-800' },
  uncommon_goods:    { label: 'Top Seller',     color: 'bg-emerald-100 text-emerald-800' },
  amazon_bestseller: { label: 'Bestseller',     color: 'bg-amber-100 text-amber-800' },
  etsy_trending:     { label: 'Trending',       color: 'bg-pink-100 text-pink-800' },
  reddit_occasions:  { label: 'Reddit Loved',   color: 'bg-red-100 text-red-800' },
}

function topSourceBadge(sources: any) {
  if (!sources || typeof sources !== 'object') return null
  const entries = Object.entries(sources) as [string, any][]
  if (entries.length === 0) return null
  entries.sort((a, b) => (b[1]?.weight || 0) - (a[1]?.weight || 0))
  return SOURCE_BADGES[entries[0][0]] || { label: 'Editor Pick', color: 'bg-gray-100 text-gray-700' }
}

function categoryGlyph(p: GiftProduct) {
  if (p.interests?.includes('reading')) return <BookOpen className="h-3 w-3" />
  if (p.occasions?.includes('mothers-day')) return <span className="text-xs">🌸</span>
  return <Heart className="h-3 w-3" />
}

export function PicksCarousel({ picks }: { picks: GiftProduct[] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [activeProduct, setActiveProduct] = useState<GiftProduct | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const slides = picks.slice(0, 9)
  const count = slides.length

  // Auto-advance — scrolls the strip and updates the highlighted card.
  useEffect(() => {
    if (paused || count <= 1) return
    const t = setInterval(() => setActiveIdx(i => (i + 1) % count), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused, count])

  // When activeIdx changes, scroll the strip so the active card is in view.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const card = track.children[activeIdx] as HTMLElement | undefined
    if (!card) return
    track.scrollTo({ left: card.offsetLeft - 12, behavior: 'smooth' })
  }, [activeIdx])

  const goto = useCallback((i: number) => {
    if (count === 0) return
    setActiveIdx(((i % count) + count) % count)
  }, [count])

  if (count === 0) return null

  const handleCardClick = (p: GiftProduct) => {
    if (p.trackedSlug) trackClick(p.trackedSlug, 'CARD_CLICK', 'WEB')
    setActiveProduct(p)
  }
  const handleBuy = (p: GiftProduct) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0) return
    if (!p.trackedSlug) return
    e.preventDefault()
    window.open(buildRetailerHref(p.trackedSlug), '_blank', 'noopener,noreferrer')
  }

  return (
    <section
      className="relative max-w-6xl mx-auto px-4 py-5 sm:py-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <Sparkles className="h-4 w-4 text-pink-500" />
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
            This Week&apos;s Picks
          </h2>
          <span className="text-[11px] text-gray-400 hidden sm:inline">
            Vetted by experts. Cycles automatically.
          </span>
        </div>
        {count > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goto(activeIdx - 1)}
              aria-label="Previous"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => goto(activeIdx + 1)}
              aria-label="Next"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Strip */}
      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4"
        style={{ scrollPaddingLeft: 16 }}
      >
        {slides.map((p, i) => {
          const badge = topSourceBadge(p.sources)
          const isActive = i === activeIdx
          const retailer = p.domain?.replace(/^www\./, '') || 'retailer'
          const isBook = p.interests?.includes('reading')
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleCardClick(p)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`snap-start flex-shrink-0 w-[260px] sm:w-[280px] text-left bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                isActive
                  ? 'border-pink-300 ring-2 ring-pink-200 shadow-xl scale-[1.02]'
                  : 'border-gray-200 hover:border-gray-300 shadow-sm'
              }`}
            >
              <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                {p.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading={i < 3 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
                {/* Top-left chip: source / book glyph */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {badge && (
                    <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                  {isBook && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-indigo-100 text-indigo-800">
                      <BookOpen className="h-2.5 w-2.5" />
                      Book
                    </span>
                  )}
                </div>
                {/* Top-right: price */}
                {p.price && (
                  <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm text-[10px] font-bold text-gray-900 px-2 py-0.5 rounded-full shadow-md">
                    {p.price}
                  </div>
                )}
                {/* Bottom-left: occasion */}
                {p.occasions?.includes('mothers-day') && (
                  <div className="absolute bottom-2 left-2 bg-pink-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                    🌸 Mother&apos;s Day
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">{retailer}</p>
                <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[2.5rem]">
                  {p.name}
                </p>
                {p.why && (
                  <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
                    {p.why}
                  </p>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  {p.trackedSlug ? (
                    <a
                      href={`/go-r/${p.trackedSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleBuy(p)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 bg-violet-600 text-white rounded-lg font-semibold text-[11px] hover:bg-violet-700 transition"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      Buy
                    </a>
                  ) : null}
                  <span className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-gray-700 border border-gray-200 rounded-lg">
                    {categoryGlyph(p)}
                    <span>Details</span>
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Dots */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goto(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1 rounded-full transition-all ${
                i === activeIdx ? 'w-5 bg-pink-500' : 'w-1 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}

      <ProductModal product={activeProduct} onClose={() => setActiveProduct(null)} />
    </section>
  )
}
