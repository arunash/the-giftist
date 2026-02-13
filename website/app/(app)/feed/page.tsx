'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ItemCard } from '@/components/feed/item-card'
import { ItemFilters } from '@/components/feed/item-filters'
import { ActivityItem } from '@/components/activity/activity-item'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { HomeChatBar } from '@/components/chat/home-chat-bar'
import { Gift, Loader2 } from 'lucide-react'
import { dummyItems, dummyActivities } from '@/lib/dummy-data'

export default function FeedPage() {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [sort] = useState('newest')
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [fundingItem, setFundingItem] = useState<any>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [useDummy, setUseDummy] = useState(false)
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
      if (!reset && cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/feed?${params}`)
      const data = await res.json()

      const fetchedItems = data.items || []

      if (reset && fetchedItems.length === 0) {
        setUseDummy(true)
        setItems(dummyItems)
      } else {
        setUseDummy(false)
        if (reset) {
          setItems(fetchedItems)
        } else {
          setItems((prev) => [...prev, ...fetchedItems])
        }
      }
      setCursor(data.nextCursor)
    } catch (error) {
      console.error('Error fetching feed:', error)
      setUseDummy(true)
      setItems(dummyItems)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, sort, cursor])

  useEffect(() => {
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((data) => setWalletBalance(data.balance || 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchFeed(true)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Two-column layout */}
        <div className="flex gap-8">
          {/* Left: Wishlist Feed */}
          <div className="flex-1 min-w-0 lg:max-w-[62%]">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">Home</h1>
              {useDummy && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  Sample data
                </span>
              )}
            </div>

            <div className="mb-6">
              <HomeChatBar />
            </div>

            <div className="mb-6">
              <ItemFilters filter={filter} onFilterChange={setFilter} />
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                    <div className="aspect-[4/5] bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Gift className="h-16 w-16" />}
                title="No items yet"
                description="Install the Chrome extension or use WhatsApp to start adding items to your wishlist."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} onFund={setFundingItem} />
                  ))}
                </div>
                {cursor && (
                  <div ref={observerRef} className="flex items-center justify-center py-6">
                    {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-gray-400" />}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Activity Feed (desktop only) */}
          <div className="hidden lg:block w-[38%] flex-shrink-0">
            <div className="sticky top-8">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Activity</h2>
                <div className="divide-y-0 space-y-0">
                  {dummyActivities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Activity feed below items */}
        <div className="lg:hidden mt-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Activity</h2>
            <div className="divide-y-0 space-y-0">
              {dummyActivities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {fundingItem && (
        <FundItemModal
          item={fundingItem}
          walletBalance={walletBalance}
          onClose={() => setFundingItem(null)}
          onFunded={() => {
            setFundingItem(null)
            fetchFeed(true)
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
