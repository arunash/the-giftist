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
import { Gift, Loader2, RefreshCw, Share2, Check, Calendar, Plus, X, ListTree, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shareOrCopy, giftistShareText, daysUntil } from '@/lib/utils'
import { dummyItems } from '@/lib/dummy-data'
import Link from 'next/link'

const EVENT_TYPE_EMOJI: Record<string, string> = {
  BIRTHDAY: '🎂',
  ANNIVERSARY: '💍',
  WEDDING: '💒',
  BABY_SHOWER: '👶',
  CHRISTMAS: '🎄',
  HOLIDAY: '🎉',
  GRADUATION: '🎓',
  OTHER: '📅',
}

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
  const [viewMode, setViewMode] = useState<'items' | 'events'>('items')
  const [events, setEvents] = useState<{ id: string; name: string; type: string; date: string; shareUrl: string | null; itemCount: number; itemImages: string[] }[]>([])
  const [eventFilter, setEventFilter] = useState<string | null>(null)
  const [eventShareCopied, setEventShareCopied] = useState<string | null>(null)
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
      if (eventFilter) params.set('eventId', eventFilter)

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
  }, [filter, sort, cursor, eventFilter])

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
      .then((data) => { if (data.shareId) setShareId(data.shareId); if (data.name) setUserName(data.name) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchFeed(true)
  }, [filter, eventFilter]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const upcomingEvents = events
    .filter((e) => daysUntil(new Date(e.date)) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

  const activityContent = (
    <>
      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Upcoming Events
            </h3>
            <Link href="/events" className="text-xs text-primary hover:text-primary-hover transition">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingEvents.map((event) => {
              const days = daysUntil(new Date(event.date))
              return (
                <button
                  key={event.id}
                  onClick={() => setEventFilter(eventFilter === event.id ? null : event.id)}
                  className={`block w-full text-left rounded-xl p-3 border transition ${
                    eventFilter === event.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-surface-hover/50 border-border hover:border-border-light'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{EVENT_TYPE_EMOJI[event.type] || '📅'}</span>
                      <div className="min-w-0">
                        <Link href={`/events/${event.id}`} className="text-sm font-medium text-white truncate hover:underline" onClick={(e) => e.stopPropagation()}>
                          {event.name}
                        </Link>
                        <p className="text-xs text-muted">{event.itemCount} item{event.itemCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        days <= 7
                          ? 'bg-red-500/10 text-red-400'
                          : days <= 30
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}
                    >
                      {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days}d`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          <Link
            href="/events/new"
            className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 text-xs font-medium text-muted hover:text-white border border-dashed border-border rounded-lg hover:border-border-light transition"
          >
            <Plus className="h-3 w-3" />
            Create Event
          </Link>
        </div>
      )}

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
                <span className="text-sm text-muted">{viewMode === 'items' ? `${items.length} items` : `${events.length} events`}</span>
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

            {/* View mode toggle pills */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setViewMode('items')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  viewMode === 'items'
                    ? 'bg-primary text-white'
                    : 'bg-surface text-muted hover:text-white border border-border'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                By Item
              </button>
              <button
                onClick={() => setViewMode('events')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  viewMode === 'events'
                    ? 'bg-primary text-white'
                    : 'bg-surface text-muted hover:text-white border border-border'
                )}
              >
                <ListTree className="h-3.5 w-3.5" />
                By Event
              </button>
            </div>

            {viewMode === 'items' ? (
              <>
                <div className="mb-4">
                  <AddProductBar onAdded={() => fetchFeed(true)} />
                </div>

                <div className="mb-6 space-y-3">
                  <ItemFilters filter={filter} onFilterChange={setFilter} />
                  {eventFilter && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full">
                        {EVENT_TYPE_EMOJI[events.find((e) => e.id === eventFilter)?.type || ''] || '📅'}
                        {events.find((e) => e.id === eventFilter)?.name || 'Event'}
                        <button onClick={() => setEventFilter(null)} className="ml-1 hover:text-white transition">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  )}
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
              </>
            ) : (
              /* By Event view */
              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                    <Calendar className="h-16 w-16 text-[#333] mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No event wishlists yet</h3>
                    <p className="text-muted mb-4">Create an event to start building wishlists for birthdays, holidays, and more.</p>
                    <Link
                      href="/events/new"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition"
                    >
                      <Plus className="h-4 w-4" />
                      Create Event
                    </Link>
                  </div>
                ) : (
                  <>
                    {events.map((event) => {
                      const days = daysUntil(new Date(event.date))
                      const eventUrl = `https://giftist.ai/events/${event.shareUrl || event.id}`
                      const isShareCopied = eventShareCopied === event.id

                      return (
                        <div
                          key={event.id}
                          className="bg-surface rounded-2xl border border-border p-4 hover:border-border-light transition"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <Link href={`/events/${event.id}`} className="flex items-center gap-3 min-w-0 group">
                              <span className="text-2xl flex-shrink-0">{EVENT_TYPE_EMOJI[event.type] || '📅'}</span>
                              <div className="min-w-0">
                                <h3 className="text-base font-semibold text-white group-hover:text-primary transition truncate">
                                  {event.name}
                                </h3>
                                <p className="text-xs text-muted">
                                  {new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                  {' · '}
                                  {event.itemCount} item{event.itemCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </Link>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={async () => {
                                  const shareText = `Check out my ${event.name} wishlist on The Giftist!`
                                  const didShare = await shareOrCopy(eventUrl, event.name, shareText)
                                  if (didShare) {
                                    setEventShareCopied(event.id)
                                    setTimeout(() => setEventShareCopied(null), 2000)
                                  }
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-white transition rounded-lg hover:bg-surface-hover"
                              >
                                {isShareCopied ? (
                                  <>
                                    <Check className="h-3 w-3 text-green-400" />
                                    <span className="text-green-400">Shared!</span>
                                  </>
                                ) : (
                                  <>
                                    <Share2 className="h-3 w-3" />
                                    <span>Share</span>
                                  </>
                                )}
                              </button>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  days < 0
                                    ? 'bg-surface-hover text-muted'
                                    : days <= 7
                                    ? 'bg-red-500/10 text-red-400'
                                    : days <= 30
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : 'bg-green-500/10 text-green-400'
                                }`}
                              >
                                {days < 0 ? 'Passed' : days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days}d`}
                              </span>
                            </div>
                          </div>

                          {/* Thumbnail strip */}
                          {event.itemImages.length > 0 && (
                            <Link href={`/events/${event.id}`} className="flex gap-2 mt-2">
                              {event.itemImages.map((img, i) => (
                                <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-surface-hover flex-shrink-0">
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                              {event.itemCount > event.itemImages.length && (
                                <div className="w-16 h-16 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0 text-xs text-muted">
                                  +{event.itemCount - event.itemImages.length}
                                </div>
                              )}
                            </Link>
                          )}
                        </div>
                      )
                    })}

                    <Link
                      href="/events/new"
                      className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-muted hover:text-white border border-dashed border-border rounded-2xl hover:border-border-light transition"
                    >
                      <Plus className="h-4 w-4" />
                      Create Event & Add Items
                    </Link>
                  </>
                )}
              </div>
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
