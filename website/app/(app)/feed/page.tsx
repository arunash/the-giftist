'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ItemCard } from '@/components/feed/item-card'
import { ItemFilters } from '@/components/feed/item-filters'
import { ActivityItem } from '@/components/activity/activity-item'
import { ActivityTabs } from '@/components/activity/activity-tabs'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { HomeChatBar } from '@/components/chat/home-chat-bar'
import { AddProductBar } from '@/components/feed/add-product-bar'
import { TrendingCarousel } from '@/components/feed/trending-carousel'
import { LinkAccountsBanner } from '@/components/ui/link-accounts-banner'
import { Gift, Loader2, RefreshCw, Share2, Check } from 'lucide-react'
import { shareOrCopy, giftistShareText } from '@/lib/utils'
import { dummyItems } from '@/lib/dummy-data'

const ACTIVITY_TYPE_CONFIG: Record<string, { emoji: string; verb: string }> = {
  ITEM_ADDED: { emoji: '🎁', verb: 'added' },
  ITEM_FUNDED: { emoji: '💰', verb: 'funded' },
  ITEM_PURCHASED: { emoji: '🎉', verb: 'purchased' },
  WALLET_DEPOSIT: { emoji: '💵', verb: 'topped up their wallet' },
  CONTRIBUTION_RECEIVED: { emoji: '❤️', verb: 'received a contribution for' },
  EVENT_CREATED: { emoji: '🎂', verb: 'created an event' },
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function transformActivity(raw: any) {
  const config = ACTIVITY_TYPE_CONFIG[raw.type] || { emoji: '📌', verb: raw.type }
  const metadata = raw.metadata ? JSON.parse(raw.metadata) : {}
  const itemName = raw.item?.name || metadata.itemName
  const action = itemName
    ? `${config.verb} *${itemName}*`
    : config.verb

  // Generate contextual badge
  let contextBadge: string | null = null
  if (raw.type === 'ITEM_FUNDED' || raw.type === 'CONTRIBUTION_RECEIVED') {
    const funded = raw.item?.fundedAmount || 0
    const goal = raw.item?.goalAmount || raw.item?.priceValue || 0
    if (goal > 0 && funded > 0) {
      const remaining = goal - funded
      if (remaining > 0 && remaining <= 50) {
        contextBadge = `🎉 Only $${remaining.toFixed(0)} left to fully fund this!`
      }
    }
  }

  return {
    id: raw.id,
    type: raw.type,
    userName: raw.user?.name || 'Someone',
    action,
    emoji: config.emoji,
    amount: metadata.amount || null,
    timeAgo: formatTimeAgo(raw.createdAt),
    itemName: raw.item?.name || null,
    itemPrice: raw.item?.price || (raw.item?.priceValue ? `$${raw.item.priceValue.toFixed(2)}` : null),
    itemImage: raw.item?.image || null,
    itemUrl: raw.item?.url || null,
    itemDomain: raw.item?.domain || null,
    contextBadge,
  }
}

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
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const observerRef = useRef<HTMLDivElement>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [shareCopied, setShareCopied] = useState(false)

  // Activity state
  const [activities, setActivities] = useState<any[]>([])
  const [activityTab, setActivityTab] = useState<'mine' | 'community'>('community')
  const [activityLoading, setActivityLoading] = useState(true)

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

  const fetchActivities = useCallback(async (tab: 'mine' | 'community') => {
    setActivityLoading(true)
    try {
      const res = await fetch(`/api/activity?tab=${tab}&limit=20`)
      const data = await res.json()
      const transformed = (data.items || []).map(transformActivity)
      setActivities(transformed)
    } catch {
      setActivities([])
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((data) => setWalletBalance(data.balance || 0))
      .catch(() => {})
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data.map((e: any) => ({ id: e.id, name: e.name })))
        }
      })
      .catch(() => {})
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => { if (data.shareId) setShareId(data.shareId); if (data.name) setUserName(data.name) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchFeed(true)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchActivities(activityTab)
  }, [activityTab]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const activityContent = (
    <>
      <div className="mb-4">
        <ActivityTabs activeTab={activityTab} onTabChange={setActivityTab} />
      </div>
      {activityLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">
          {activityTab === 'mine' ? 'No activity yet. Add an item to get started!' : 'No community activity yet.'}
        </p>
      ) : (
        <div className="divide-y-0 space-y-0">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="p-4 lg:px-10 lg:py-6">
      <div>
        {/* Two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr,500px] lg:gap-6">
          {/* Left: Wishlist Feed */}
          <div className="min-w-0">
            <LinkAccountsBanner />
            <h1 className="text-2xl font-bold text-white mb-6">Home</h1>

            <div className="mb-6">
              <HomeChatBar />
            </div>

            <div className="mb-8">
              <TrendingCarousel onAdd={() => fetchFeed(true)} />
            </div>

            {/* Your Giftist section */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Your Giftist</h2>
              <div className="flex items-center gap-3">
                {shareId && (
                  <button
                    onClick={async () => {
                      const url = `https://wa.me/15014438478?text=${encodeURIComponent(`👋 Tap send to view ${userName || 'your friend'}'s wishlist on The Giftist!\n\nview ${shareId}`)}`
                      const didShare = await shareOrCopy(url, 'My Giftist Wishlist', giftistShareText(userName || 'Your friend'))
                      if (didShare) {
                        setShareCopied(true)
                        setTimeout(() => setShareCopied(false), 2000)
                      }
                    }}
                    className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition"
                    title="Share your wishlist"
                  >
                    {shareCopied ? (
                      <>
                        <Check className="h-4 w-4 text-green-400" />
                        <span className="text-green-400">Shared!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4" />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                )}
                <span className="text-sm text-muted">{items.length} items</span>
                <button
                  onClick={() => { fetchFeed(true); fetchActivities(activityTab); }}
                  disabled={loading}
                  className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-hover transition disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <AddProductBar onAdded={() => fetchFeed(true)} />
            </div>

            <div className="mb-6">
              <ItemFilters filter={filter} onFilterChange={setFilter} />
            </div>

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-surface rounded-2xl overflow-hidden border border-border">
                    <div className="aspect-square bg-surface-hover" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-surface-hover rounded w-3/4" />
                      <div className="h-3 bg-surface-hover rounded w-1/2" />
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      ownerName={userName}
                      onFund={setFundingItem}
                      onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                      events={events}
                    />
                  ))}
                </div>
                {cursor && (
                  <div ref={observerRef} className="flex items-center justify-center py-6">
                    {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted" />}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Activity Feed (desktop only) */}
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <div className="bg-surface rounded-2xl border border-border p-5">
                {activityContent}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Activity feed below items */}
        <div className="lg:hidden mt-8">
          <div className="bg-surface rounded-2xl border border-border p-5">
            {activityContent}
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
            fetchActivities(activityTab)
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
