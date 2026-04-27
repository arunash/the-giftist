'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Sparkles, ExternalLink, MessageCircle } from 'lucide-react'
import { trackClick, buildRetailerHref } from '@/lib/track-click'
import type { GiftProduct } from './gift-grid'
import { ProductModal } from './product-modal'

const ROTATE_MS = 4500   // auto-advance every 4.5s
const SOURCE_LABELS: Record<string, string> = {
  wirecutter: 'Wirecutter Pick',
  strategist: 'NY Mag Strategist',
  oprah_daily: "Oprah's Pick",
  uncommon_goods: 'Top Seller',
  amazon_bestseller: 'Bestseller',
  etsy_trending: 'Trending on Etsy',
  reddit_occasions: 'Reddit Loved',
}
function topSourceLabel(sources: any): string | null {
  if (!sources || typeof sources !== 'object') return null
  const entries = Object.entries(sources) as [string, any][]
  if (entries.length === 0) return null
  entries.sort((a, b) => (b[1]?.weight || 0) - (a[1]?.weight || 0))
  return SOURCE_LABELS[entries[0][0]] || 'Editor Pick'
}

export function PicksCarousel({ picks }: { picks: GiftProduct[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [activeProduct, setActiveProduct] = useState<GiftProduct | null>(null)
  const slideRef = useRef<HTMLDivElement>(null)

  const slides = picks.slice(0, 8)
  const count = slides.length

  const goto = useCallback((i: number) => {
    if (count === 0) return
    setIndex(((i % count) + count) % count)
  }, [count])

  // Auto-advance
  useEffect(() => {
    if (paused || count <= 1) return
    const t = setInterval(() => setIndex(i => (i + 1) % count), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused, count])

  // Reset interval whenever user interacts manually
  useEffect(() => {
    if (slideRef.current) slideRef.current.scrollTo({ left: index * slideRef.current.clientWidth, behavior: 'smooth' })
  }, [index])

  if (count === 0) return null

  const current = slides[index]
  const retailer = current.domain?.replace(/^www\./, '') || 'retailer'
  const onCardClick = () => {
    if (current.trackedSlug) trackClick(current.trackedSlug, 'CARD_CLICK', 'WEB')
    setActiveProduct(current)
  }
  const onBuy = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0) return
    if (!current.trackedSlug) return
    e.preventDefault()
    window.open(buildRetailerHref(current.trackedSlug), '_blank', 'noopener,noreferrer')
  }

  return (
    <section
      className="relative max-w-6xl mx-auto px-4 py-6 sm:py-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      {/* Header */}
      <div className="flex items-end justify-between mb-3 sm:mb-4">
        <div>
          <p className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] uppercase tracking-wider text-pink-600 font-bold mb-1">
            <Sparkles className="h-3 w-3" /> Editor&apos;s Picks This Week
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Vetted by experts, loved by gift-givers
          </h2>
        </div>
        {count > 1 && (
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => goto(index - 1)}
              aria-label="Previous"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => goto(index + 1)}
              aria-label="Next"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Slide */}
      <div className="relative bg-gradient-to-br from-pink-50 via-white to-amber-50 rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
        <button
          onClick={onCardClick}
          aria-label={`See details for ${current.name}`}
          className="block w-full text-left"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 items-stretch min-h-[360px] sm:min-h-[440px]">
            {/* Image side */}
            <div className="relative aspect-[4/3] sm:aspect-auto bg-white overflow-hidden">
              {current.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={current.id}  // re-mounts on slide change so transition is crisp
                  src={current.image}
                  alt={current.name}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-gray-300">No image</span>
                </div>
              )}
              {topSourceLabel(current.sources) && (
                <div className="absolute top-3 left-3 inline-flex items-center gap-1 bg-white/95 backdrop-blur-sm text-gray-900 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                  {topSourceLabel(current.sources)}
                </div>
              )}
              {current.occasions?.includes('mothers-day') && (
                <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-pink-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                  🌸 Mother&apos;s Day
                </div>
              )}
            </div>

            {/* Copy side */}
            <div className="flex flex-col justify-between p-5 sm:p-7 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{retailer}</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mt-1.5 line-clamp-2 sm:line-clamp-3">
                  {current.name}
                </h3>
                {current.price && (
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">{current.price}</p>
                )}
                {current.why && (
                  <p className="text-sm text-gray-600 leading-relaxed mt-3 line-clamp-3">
                    {current.why}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                {current.trackedSlug && (
                  <a
                    href={`/go-r/${current.trackedSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onBuy}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition shadow-md shadow-violet-600/30"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Buy on {retailer}
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCardClick() }}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-white text-gray-900 rounded-xl font-semibold text-sm border-2 border-gray-200 hover:border-gray-300 transition"
                >
                  See details
                </button>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Dots */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goto(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-gray-900' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}

      {/* Modal mounts on click */}
      <ProductModal product={activeProduct} onClose={() => setActiveProduct(null)} />
    </section>
  )
}
