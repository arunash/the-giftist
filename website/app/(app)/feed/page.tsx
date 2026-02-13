'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ItemCard } from '@/components/feed/item-card'
import { ItemFilters } from '@/components/feed/item-filters'
import { SuggestionCard } from '@/components/feed/suggestion-card'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Gift, Loader2 } from 'lucide-react'

export default function FeedPage() {
  const [items, setItems] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [category, setCategory] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [fundingItem, setFundingItem] = useState<any>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const observerRef = useRef<HTMLDivElement>(null)

  const fetchFeed = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      setItems([])
      setCursor(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({ filter, sort, limit: '12' })
      if (category) params.set('category', category)
      if (!reset && cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/feed?${params}`)
      const data = await res.json()

      if (reset) {
        setItems(data.items || [])
        setCategories(data.categories || [])
      } else {
        setItems((prev) => [...prev, ...(data.items || [])])
      }
      setCursor(data.nextCursor)
    } catch (error) {
      console.error('Error fetching feed:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, sort, category, cursor])

  // Fetch suggestions on mount
  useEffect(() => {
    fetch('/api/feed/suggestions')
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {})

    fetch('/api/wallet')
      .then((r) => r.json())
      .then((data) => setWalletBalance(data.balance || 0))
      .catch(() => {})
  }, [])

  // Reset feed when filters change
  useEffect(() => {
    fetchFeed(true)
  }, [filter, sort, category]) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer
  useEffect(() => {
    if (!observerRef.current || !cursor) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          fetchFeed(false)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [cursor, loadingMore]) // eslint-disable-line react-hooks/exhaustive-deps

  // Interleave suggestion cards
  function renderItems() {
    const elements: React.ReactNode[] = []
    items.forEach((item, i) => {
      elements.push(
        <ItemCard key={item.id} item={item} onFund={setFundingItem} />
      )
      // Insert suggestion card every 5-6 items
      if ((i + 1) % 6 === 0) {
        const sugIdx = Math.floor((i + 1) / 6) - 1
        if (suggestions[sugIdx]) {
          elements.push(
            <div key={`sug-${sugIdx}`} className="sm:col-span-2">
              <SuggestionCard suggestion={suggestions[sugIdx]} />
            </div>
          )
        }
      }
    })
    return elements
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-secondary">Your Items</h1>

        <ItemFilters
          filter={filter}
          sort={sort}
          category={category}
          categories={categories}
          onFilterChange={setFilter}
          onSortChange={setSort}
          onCategoryChange={setCategory}
        />

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100">
                <div className="h-40 bg-gray-200 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Gift className="h-16 w-16" />}
            title="No items yet"
            description={
              filter !== 'all'
                ? 'No items match the current filters. Try adjusting your filters.'
                : 'Install the Chrome extension or use WhatsApp to start adding items to your wishlist.'
            }
          />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderItems()}
            </div>
            {/* Infinite scroll trigger */}
            {cursor && (
              <div ref={observerRef} className="flex items-center justify-center py-6">
                {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-gray-400" />}
              </div>
            )}
          </>
        )}
      </div>

      {fundingItem && (
        <FundItemModal
          item={fundingItem}
          walletBalance={walletBalance}
          onClose={() => setFundingItem(null)}
          onFunded={() => {
            setFundingItem(null)
            fetchFeed(true)
            // Refresh wallet balance
            fetch('/api/wallet')
              .then((r) => r.json())
              .then((data) => setWalletBalance(data.balance || 0))
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}
