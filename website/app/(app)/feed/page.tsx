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

  // Compute actionBadge — rule-based, no extra AI calls
  let actionBadge: { label: string; href?: string; itemId?: string } | null = null

  if (raw.type === 'ITEM_ADDED' && raw.item?.goalAmount && raw.userId !== raw.item?.userId) {
    // Community item with goal — suggest contributing
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
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [fundingItem, setFundingItem] = useState<any>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [useDummy, setUseDummy] = useState(false)
  const [viewMode, setViewMode] = useState<'items' | 'events'>('events')
  const [events, setEvents] = useState<{ id: string; name: string; type: string; date: string; shareUrl: string | null; itemCount: number; itemImages: string[] }[]>([])
  const [eventFilter, setEventFilter] = useState<string | null>(null)
  const [eventShareCopied, setEventShareCopied] = useState<string | null>(null)
  const observerRef = useRef<HTMLDivElement>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [shareCopied, setShareCopied] = useState(false)
  const [userInterests, setUserInterests] = useState<string[]>([])

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
      if (search) params.set('search', search)

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
  }, [filter, sort, cursor, eventFilter, search])

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
      .then((data) => {
        if (data.shareId) setShareId(data.shareId)
        if (data.name) setUserName(data.name)
        if (Array.isArray(data.interests) && data.interests.length > 0) setUserInterests(data.interests)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchFeed(true)
  }, [filter, sort, search, eventFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset sort when switching between items/events views
  useEffect(() => {
    setSort('newest')
    setSearch('')
  }, [viewMode])

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

  function getAttentionBadge(e: { date: string; itemCount: number }): { label: string; color: string } | null {
    const days = daysUntil(new Date(e.date))
    if (days <= 7 && e.itemCount < 3) return { label: 'Needs attention', color: 'red' }
    if (days <= 14 && e.itemCount === 0) return { label: 'Needs gifts', color: 'amber' }
    return null
  }

  const futureEvents = events
    .filter((e) => daysUntil(new Date(e.date)) >= 0)
    .sort((a, b) => eventPriorityScore(b) - eventPriorityScore(a))

  const pastEvents = events
    .filter((e) => daysUntil(new Date(e.date)) < 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
                  // Open fund modal for the item
                  setFundingItem({ id: a.itemId, name: activity.itemName })
                }
                // href-based actions are handled by the component link
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
          {/* Left: Wishlist Feed */}
          <div className="min-w-0">
            <LinkAccountsBanner />
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Home</h1>

            <div className="mb-6">
              <HomeChatBar />
            </div>

            <div className="mb-8">
              <TrendingCarousel onAdd={() => fetchFeed(true)} />
            </div>

            {/* Your Giftist — single-line header with all controls */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900 mr-1">Your Giftist</h2>

              {userInterests.length > 0 ? (
                <Link href="/settings" className="flex items-center gap-1 text-xs text-secondary hover:text-gray-900 transition mr-1">
                  <span>✨</span>
                  <span>You love <strong>{userInterests.slice(0, 3).join(', ')}</strong></span>
                  <span className="text-primary font-semibold ml-0.5">Edit →</span>
                </Link>
              ) : (
                <Link href="/settings" className="flex items-center gap-1 text-xs text-muted hover:text-gray-900 transition mr-1">
                  <span>✨</span>
                  <span>Tell us what you love</span>
                  <span className="text-primary font-semibold ml-0.5">Set up →</span>
                </Link>
              )}

              <ItemFilters filter={filter} onFilterChange={setFilter} sort={sort} onSortChange={setSort} search={search} onSearchChange={setSearch} mode={viewMode} />

              <span className="w-px h-6 bg-border self-center mx-0.5" />

              <button
                onClick={() => setViewMode('events')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  viewMode === 'events'
                    ? 'bg-primary text-white'
                    : 'bg-surface text-muted hover:text-gray-900 border border-border'
                )}
              >
                <ListTree className="h-3.5 w-3.5" />
                By Event
              </button>
              <button
                onClick={() => setViewMode('items')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  viewMode === 'items'
                    ? 'bg-primary text-white'
                    : 'bg-surface text-muted hover:text-gray-900 border border-border'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                By Item
              </button>

              <div className="flex items-center gap-2 ml-auto">
                {shareId && (
                  <button
                    onClick={async () => {
                      const url = `https://giftist.ai/u/${shareId}`
                      const didShare = await shareOrCopy(url, 'My Giftist Wishlist', giftistShareText(userName || 'Your friend'))
                      if (didShare) {
                        setShareCopied(true)
                        setTimeout(() => setShareCopied(false), 2000)
                      }
                    }}
                    className="flex items-center gap-1.5 text-sm text-muted hover:text-gray-900 transition"
                    title="Share your wishlist"
                  >
                    {shareCopied ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Shared!</span>
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
                  className="p-1.5 rounded-lg text-muted hover:text-gray-900 hover:bg-surface-hover transition disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Stories-style event circles — future events only */}
            {futureEvents.length > 0 && (
              <div className="mb-6 -mx-1 px-1">
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {futureEvents.map((event) => {
                    const days = daysUntil(new Date(event.date))
                    const firstImage = event.itemImages[0]
                    return (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0 group/story"
                      >
                        <div className="ig-stories-ring">
                          <div className="ig-stories-ring-inner">
                            <div className="w-16 h-16 rounded-full overflow-hidden ig-image-wrap">
                              {firstImage ? (
                                <img src={firstImage} alt={event.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <span className="text-2xl">{EVENT_TYPE_EMOJI[event.type] || '📅'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-gray-900 max-w-[72px] truncate">{event.name}</span>
                        <span className={`text-[10px] font-medium -mt-1 ${days <= 7 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-gray-400'}`}>
                          {days < 0 ? 'Passed' : days === 0 ? 'Today!' : `${days}d`}
                        </span>
                      </Link>
                    )
                  })}
                  <Link
                    href="/events/new"
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="rounded-full p-[2.5px] bg-transparent">
                      <div className="bg-white p-0.5 rounded-full">
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 transition">
                          <Plus className="h-6 w-6 text-gray-300" />
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-gray-400">New</span>
                  </Link>
                </div>
              </div>
            )}

            {viewMode === 'items' ? (
              <>
                <div className="mb-4">
                  <AddProductBar onAdded={() => fetchFeed(true)} />
                </div>

                {eventFilter && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full">
                      {EVENT_TYPE_EMOJI[events.find((e) => e.id === eventFilter)?.type || ''] || '📅'}
                      {events.find((e) => e.id === eventFilter)?.name || 'Event'}
                      <button onClick={() => setEventFilter(null)} className="ml-1 hover:text-gray-900 transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                )}

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
              </>
            ) : (
              /* By Event view — Instagram-style card grid */
              <>
                {events.length === 0 ? (
                  <div className="ig-card p-12 text-center">
                    <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No event wishlists yet</h3>
                    <p className="text-gray-400 mb-4">Create an event to start building wishlists for birthdays, holidays, and more.</p>
                    <Link
                      href="/events/new"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition"
                    >
                      <Plus className="h-4 w-4" />
                      Create Event
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Upcoming events */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {futureEvents.map((event) => {
                        const days = daysUntil(new Date(event.date))
                        const eventUrl = `https://giftist.ai/events/${event.shareUrl || event.id}`
                        const isShareCopied = eventShareCopied === event.id
                        const images = event.itemImages

                        return (
                          <div
                            key={event.id}
                            className="ig-card group relative overflow-hidden cursor-pointer"
                          >
                            <Link href={`/events/${event.id}`}>
                              <div className="ig-image-wrap aspect-square">
                                {images.length >= 4 ? (
                                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-[1px] bg-white">
                                    {images.slice(0, 4).map((img, i) => (
                                      <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                                    ))}
                                  </div>
                                ) : images.length >= 1 ? (
                                  <img
                                    src={images[0]}
                                    alt={event.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
                                    <span className="text-6xl">{EVENT_TYPE_EMOJI[event.type] || '📅'}</span>
                                  </div>
                                )}

                                <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5">
                                  <div
                                    className={`ig-glass px-3 py-1.5 rounded-full text-sm font-semibold ${
                                      days <= 7
                                        ? '!bg-red-500/80 text-white'
                                        : days <= 30
                                        ? '!bg-amber-500/80 text-white'
                                        : 'text-white'
                                    }`}
                                  >
                                    {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days`}
                                  </div>
                                  {(() => {
                                    const badge = getAttentionBadge(event)
                                    if (!badge) return null
                                    return (
                                      <div className={`ig-glass px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        badge.color === 'red' ? '!bg-red-500/90 text-white' : '!bg-amber-500/90 text-white'
                                      }`}>
                                        {badge.label}
                                      </div>
                                    )
                                  })()}
                                </div>

                                <div className="absolute top-3 right-3 ig-glass px-2.5 py-1 rounded-full text-white text-xs font-medium z-10">
                                  {event.itemCount} item{event.itemCount !== 1 ? 's' : ''}
                                </div>

                                <div className="ig-overlay absolute inset-0 z-20 flex flex-col justify-end p-3">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={async (e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        const shareText = `Check out my ${event.name} wishlist on The Giftist!`
                                        const didShare = await shareOrCopy(eventUrl, event.name, shareText)
                                        if (didShare) {
                                          setEventShareCopied(event.id)
                                          setTimeout(() => setEventShareCopied(null), 2000)
                                        }
                                      }}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs hover:bg-white/30 transition"
                                    >
                                      {isShareCopied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                                      {isShareCopied ? 'Shared!' : 'Share'}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="p-3">
                                <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                                  {event.name}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </Link>
                          </div>
                        )
                      })}

                      {/* Create event card */}
                      <Link
                        href="/events/new"
                        className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all duration-300 aspect-[3/4]"
                      >
                        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-2 group-hover:bg-primary/10 transition">
                          <Plus className="h-5 w-5 text-gray-300 group-hover:text-primary transition" />
                        </div>
                        <span className="text-sm font-medium text-gray-400 group-hover:text-gray-900 transition">New Event</span>
                      </Link>
                    </div>

                    {/* Completed (past) events */}
                    {pastEvents.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Completed</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          {pastEvents.map((event) => {
                            const images = event.itemImages
                            return (
                              <div
                                key={event.id}
                                className="ig-card group relative overflow-hidden cursor-pointer opacity-60 hover:opacity-90 transition-opacity"
                              >
                                <Link href={`/events/${event.id}`}>
                                  <div className="ig-image-wrap aspect-square grayscale group-hover:grayscale-0 transition-all duration-300">
                                    {images.length >= 4 ? (
                                      <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-[1px] bg-white">
                                        {images.slice(0, 4).map((img, i) => (
                                          <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                                        ))}
                                      </div>
                                    ) : images.length >= 1 ? (
                                      <img src={images[0]} alt={event.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
                                        <span className="text-6xl">{EVENT_TYPE_EMOJI[event.type] || '📅'}</span>
                                      </div>
                                    )}

                                    <div className="absolute bottom-3 left-3 ig-glass px-3 py-1.5 rounded-full text-sm font-semibold text-white/60 z-10">
                                      Completed
                                    </div>

                                    <div className="absolute top-3 right-3 ig-glass px-2.5 py-1 rounded-full text-white text-xs font-medium z-10">
                                      {event.itemCount} item{event.itemCount !== 1 ? 's' : ''}
                                    </div>
                                  </div>

                                  <div className="p-3">
                                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{event.name}</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                  </div>
                                </Link>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
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
