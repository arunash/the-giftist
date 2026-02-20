'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ItemCard } from '@/components/feed/item-card'
import { ActivityItem } from '@/components/activity/activity-item'
import { ActivityTabs } from '@/components/activity/activity-tabs'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { HomeChatBar } from '@/components/chat/home-chat-bar'
import { AddProductBar } from '@/components/feed/add-product-bar'
import { TrendingCarousel } from '@/components/feed/trending-carousel'
import { LinkAccountsBanner } from '@/components/ui/link-accounts-banner'
import { AiNudgeBanner } from '@/components/feed/ai-nudge-banner'
import { EventCard, NewEventCard } from '@/components/feed/event-card'
import { Gift, Loader2, Calendar, Plus } from 'lucide-react'
import { daysUntil } from '@/lib/utils'
import { dummyItems } from '@/lib/dummy-data'
import Link from 'next/link'

const ACTIVITY_TYPE_CONFIG: Record<string, { emoji: string; verb: string }> = {
  ITEM_ADDED: { emoji: '🎁', verb: 'added' },
  ITEM_FUNDED: { emoji: '💰', verb: 'funded' },
  ITEM_PURCHASED: { emoji: '🎉', verb: 'purchased' },
  WALLET_DEPOSIT: { emoji: '💵', verb: 'topped up their wallet' },
  CONTRIBUTION_RECEIVED: { emoji: '❤️', verb: 'received a contribution for' },
  EVENT_CREATED: { emoji: '🎂', verb: 'created an event' },
  EVENT_ITEM_ADDED: { emoji: '📌', verb: 'added to event' },
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
  let action: string
  if (raw.type === 'EVENT_ITEM_ADDED' && itemName && metadata.eventName) {
    action = `added *${itemName}* to *${metadata.eventName}*`
  } else if (raw.type === 'EVENT_CREATED' && metadata.eventName) {
    action = `${config.verb} *${metadata.eventName}*`
  } else {
    action = itemName ? `${config.verb} *${itemName}*` : config.verb
  }

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

  let actionBadge: { label: string; href?: string; itemId?: string } | null = null
  if (raw.type === 'ITEM_ADDED' && raw.item?.goalAmount && raw.userId !== raw.item?.userId) {
    actionBadge = { label: 'Contribute $20?', itemId: raw.item?.id }
  } else if (raw.type === 'ITEM_FUNDED') {
    const funded = raw.item?.fundedAmount || 0
    const goal = raw.item?.goalAmount || raw.item?.priceValue || 0
    const remaining = goal - funded
    if (remaining > 0 && remaining <= 50) {
      actionBadge = { label: `Chip in $${remaining.toFixed(0)}?`, itemId: raw.item?.id }
    }
  } else if (raw.type === 'CONTRIBUTION_RECEIVED') {
    const contributorName = metadata.contributorName || 'them'
    actionBadge = {
      label: 'Send thank you',
      href: `/chat?q=${encodeURIComponent(`Help me write a thank you note for ${contributorName}'s gift contribution`)}`,
    }
  } else if (raw.type === 'EVENT_CREATED' && metadata.eventName && raw.userId !== raw.item?.userId) {
    actionBadge = {
      label: 'Browse gift ideas',
      href: `/chat?q=${encodeURIComponent(`Gift ideas for ${metadata.eventName}`)}`,
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
    actionBadge,
  }
}

export default function FeedPage() {
  const [items, setItems] = useState<any[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [fundingItem, setFundingItem] = useState<any>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [useDummy, setUseDummy] = useState(false)
  const [events, setEvents] = useState<{ id: string; name: string; type: string; date: string; shareUrl: string | null; itemCount: number; fundedAmount: number; itemImages: string[] }[]>([])
  const observerRef = useRef<HTMLDivElement>(null)
  const [userName, setUserName] = useState<string>('')

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
      const params = new URLSearchParams({ sort: 'newest', limit: '12' })
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
  }, [cursor])

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
          setEvents(data.map((e: any) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            date: e.date,
            shareUrl: e.shareUrl || null,
            itemCount: e.items?.length || 0,
            fundedAmount: (e.items || []).reduce((sum: number, ei: any) => sum + (ei.item?.fundedAmount || 0), 0),
            itemImages: (e.items || [])
              .map((ei: any) => ei.item?.image)
              .filter(Boolean)
              .slice(0, 4),
          })))
        }
      })
      .catch(() => {})
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setUserName(data.name)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchFeed(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Smart sort: priority score based on urgency + readiness
  function eventPriorityScore(e: { date: string; itemCount: number }) {
    const days = daysUntil(new Date(e.date))
    let score = 1000 - days
    if (e.itemCount === 0) score += 500
    if (days <= 7 && e.itemCount < 3) score += 300
    if (days <= 3) score += 200
    return score
  }

  const futureEvents = events
    .filter((e) => daysUntil(new Date(e.date)) >= 0)
    .sort((a, b) => eventPriorityScore(b) - eventPriorityScore(a))

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
            <ActivityItem
              key={activity.id}
              activity={activity}
              onAction={(a) => {
                if (a.itemId) {
                  setFundingItem({ id: a.itemId, name: activity.itemName })
                }
              }}
            />
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
          {/* Left: Main Content */}
          <div className="min-w-0">
            <LinkAccountsBanner />
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Home</h1>

            {/* 1. AI Nudge Banner */}
            <AiNudgeBanner />

            {/* 2. Gift Concierge */}
            <div className="mb-6">
              <HomeChatBar />
            </div>

            {/* 3. Your Events */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Your Events</h2>
                <Link
                  href="/events/new"
                  className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-hover transition"
                >
                  <Plus className="h-4 w-4" />
                  New Event
                </Link>
              </div>
              {futureEvents.length === 0 ? (
                <div className="ig-card p-10 text-center">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No upcoming events</h3>
                  <p className="text-sm text-gray-400 mb-4">Create an event to start building wishlists for birthdays, holidays, and more.</p>
                  <Link
                    href="/events/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition"
                  >
                    <Plus className="h-4 w-4" />
                    Create Event
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {futureEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                  <NewEventCard />
                </div>
              )}
            </section>

            {/* 4. Trending For You */}
            <div className="mb-8">
              <TrendingCarousel onAdd={() => fetchFeed(true)} />
            </div>

            {/* 5. Your Wishlist */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Your Wishlist
                  <span className="ml-2 text-sm font-normal text-gray-400">{items.length} items</span>
                </h2>
              </div>

              <div className="mb-4">
                <AddProductBar onAdded={() => fetchFeed(true)} />
              </div>

              {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="ig-card overflow-hidden">
                      <div className="aspect-square bg-gray-100" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            </section>
          </div>

          {/* Right: Activity Feed (desktop only) */}
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <div className="ig-card !transform-none p-5">
                {activityContent}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Activity feed below items */}
        <div className="lg:hidden mt-8">
          <div className="ig-card !transform-none p-5">
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
