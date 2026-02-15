'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, Plus, Loader2 } from 'lucide-react'

interface TrendingItem {
  name: string
  price: string
  category: string
  image: string
  url: string
}

interface TrendingCarouselProps {
  onAdd?: (item: TrendingItem) => void
}

const CACHE_KEY = 'giftist_trending_cache'

function loadCache(): TrendingItem[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveCache(items: TrendingItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items))
  } catch {}
}

export function TrendingCarousel({ onAdd }: TrendingCarouselProps) {
  const [items, setItems] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())
  const [addingIdx, setAddingIdx] = useState<number | null>(null)
  const [addedSet, setAddedSet] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleImageError = useCallback((idx: number) => {
    setFailedImages((prev) => new Set(prev).add(idx))
  }, [])

  // Save only items with working images to cache after render settles
  useEffect(() => {
    if (items.length === 0 || loading) return
    const timer = setTimeout(() => {
      const good = items.filter((_, i) => !failedImages.has(i))
      if (good.length > 0) saveCache(good)
    }, 3000)
    return () => clearTimeout(timer)
  }, [items, failedImages, loading])

  useEffect(() => {
    const cached = loadCache()
    if (cached.length > 0) {
      setItems(cached)
      setLoading(false)
    }

    async function fetchTrending() {
      try {
        const res = await fetch('/api/feed/trending')
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setItems(data)
          setFailedImages(new Set())
          return
        }
      } catch {}
      if (cached.length > 0) setItems(cached)
    }

    fetchTrending().finally(() => setLoading(false))
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth / 4 + 12
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  const handleAdd = async (item: TrendingItem, idx: number) => {
    if (addingIdx !== null || addedSet.has(idx)) return
    setAddingIdx(idx)
    try {
      const res = await fetch('/api/items/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url, source: 'CHAT' }),
      })
      if (res.ok) {
        setAddedSet((prev) => new Set(prev).add(idx))
        onAdd?.(item)
      } else {
        // Fallback: create item directly
        const fallbackRes = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            price: item.price,
            image: item.image,
            url: item.url,
            source: 'CHAT',
            category: item.category,
          }),
        })
        if (fallbackRes.ok) {
          setAddedSet((prev) => new Set(prev).add(idx))
          onAdd?.(item)
        }
      }
    } catch {}
    setAddingIdx(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted" />
        <span className="text-xs text-muted">Finding trending items for you...</span>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Trending For You</h3>
        </div>
        <span className="text-xs text-muted flex items-center gap-1">
          <span className="text-primary">✨</span> Curated by AI
        </span>
      </div>

      <div className="relative group">
        {/* Left arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-surface-raised border border-border rounded-full opacity-0 group-hover:opacity-100 transition -translate-x-2"
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex-shrink-0 w-[calc((100%-0.5rem)/2)] lg:w-[calc((100%-1.5rem)/4)] bg-surface rounded-2xl border border-border overflow-hidden hover:border-border-light transition-all duration-300 group/card ${failedImages.has(i) ? 'hidden' : ''}`}
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Product image */}
              <div className="relative aspect-square bg-surface-hover overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover saturate-[1.1] contrast-[1.05] brightness-[1.02] group-hover/card:scale-105 transition-transform duration-500"
                  onError={() => handleImageError(i)}
                />
                {/* Category pill */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-medium text-white uppercase tracking-wide">
                  {item.category}
                </div>
                {/* Price pill */}
                {item.price && (
                  <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-md text-sm font-semibold text-white">
                    {item.price}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-3">
                <h4 className="text-sm font-medium text-white line-clamp-1 mb-1">{item.name}</h4>
                <button
                  onClick={() => handleAdd(item, i)}
                  disabled={addingIdx === i || addedSet.has(i)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-50 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {addedSet.has(i) ? (
                    'Added!'
                  ) : addingIdx === i ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      Add to List
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-surface-raised border border-border rounded-full opacity-0 group-hover:opacity-100 transition translate-x-2"
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  )
}
