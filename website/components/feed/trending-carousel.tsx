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

const CACHE_KEY = 'giftist_trending_v3'

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
      const good = items.filter((item, i) => item.image && !failedImages.has(i))
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

    const interval = setInterval(() => {
      fetchTrending()
    }, 120000)
    return () => clearInterval(interval)
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth / 2
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

  // Only show items that have working images
  const visibleItems = items
    .map((item, i) => ({ item, originalIdx: i }))
    .filter(({ item, originalIdx }) => item.image && !failedImages.has(originalIdx))

  if (visibleItems.length < 3) return null

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-900">Trending For You</h3>
        </div>
        <span className="text-xs text-muted flex items-center gap-1">
          <span className="text-primary">✨</span> Curated by AI
        </span>
      </div>

      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white shadow-md rounded-full opacity-0 group-hover:opacity-100 transition -translate-x-2"
        >
          <ChevronLeft className="h-4 w-4 text-gray-900" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {visibleItems.map(({ item, originalIdx }) => (
            <div
              key={originalIdx}
              className="flex-shrink-0 w-[calc((100%-0.5rem)/2)] lg:w-[calc((100%-1.5rem)/4)] ig-card overflow-hidden group/card"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="ig-image-wrap aspect-square">
                <img
                  src={item.image}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(originalIdx)}
                />
                <div className="absolute top-2 left-2 ig-glass px-2.5 py-0.5 rounded-full text-[10px] font-medium text-white uppercase tracking-wide z-10">
                  {item.category}
                </div>
                {item.price && (
                  <div className="absolute bottom-3 left-3 ig-glass px-3 py-1.5 rounded-full text-sm font-semibold text-white z-10">
                    {item.price}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-1.5">{item.name}</h4>
                <button
                  onClick={() => handleAdd(item, originalIdx)}
                  disabled={addingIdx === originalIdx || addedSet.has(originalIdx)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-full transition disabled:opacity-50 bg-primary-light text-primary hover:bg-primary/20"
                >
                  {addedSet.has(originalIdx) ? (
                    'Added!'
                  ) : addingIdx === originalIdx ? (
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

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white shadow-md rounded-full opacity-0 group-hover:opacity-100 transition translate-x-2"
        >
          <ChevronRight className="h-4 w-4 text-gray-900" />
        </button>
      </div>
    </div>
  )
}
