'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { SuggestionChip } from '@/components/chat/suggestion-chip'
import { ActivityItem } from '@/components/activity/activity-item'
import { ActivityTabs } from '@/components/activity/activity-tabs'
import { useChatStream } from '@/lib/hooks/use-chat-stream'
import { MessageCircle, Gift, Send, ArrowDown, ChevronLeft, ChevronRight, ExternalLink, Package, Truck, Check, Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'

const defaultSuggestions = [
  'What should I get next?',
  'Gift ideas for upcoming events',
  'What\'s trending?',
]

/* ─── Activity helpers (from feed page) ─── */

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
        contextBadge = `Only $${remaining.toFixed(0)} left to fully fund this!`
      }
    }
  }

  let actionBadge: { label: string; href?: string; itemId?: string } | null = null
  if (raw.type === 'ITEM_ADDED' && raw.item?.goalAmount && raw.userId !== raw.item?.userId) {
    actionBadge = { label: 'Contribute $20?', itemId: raw.item?.id }
  } else if (raw.type === 'CONTRIBUTION_RECEIVED') {
    const contributorName = metadata.contributorName || 'them'
    actionBadge = {
      label: 'Send thank you',
      href: `/chat?q=${encodeURIComponent(`Help me write a thank you note for ${contributorName}'s gift contribution`)}`,
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

/* ─── Gift types + config ─── */

interface GiftItem {
  id: string
  itemName: string
  itemImage: string | null
  amount: number
  status: string
  recipientName?: string
  senderName?: string
  senderMessage: string | null
  redeemCode: string
  createdAt: string
  direction: 'sent' | 'received'
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  PAID: { label: 'Paid', icon: Check, color: 'text-blue-400 bg-blue-500/10' },
  NOTIFIED: { label: 'Sent', icon: Send, color: 'text-primary bg-primary/10' },
  REDEEMED: { label: 'Redeemed', icon: Gift, color: 'text-green-400 bg-green-500/10' },
  REDEEMED_PENDING_SHIPMENT: { label: 'Shipping', icon: Package, color: 'text-amber-400 bg-amber-500/10' },
  SHIPPED: { label: 'Shipped', icon: Truck, color: 'text-blue-400 bg-blue-500/10' },
  DELIVERED: { label: 'Delivered', icon: Check, color: 'text-green-400 bg-green-500/10' },
  PENDING: { label: 'Pending', icon: Clock, color: 'text-gray-400 bg-gray-500/10' },
}

/* ─── Gifts Carousel ─── */

function GiftsCarousel({ gifts, loading: giftsLoading }: { gifts: GiftItem[]; loading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll)
    return () => el.removeEventListener('scroll', checkScroll)
  }, [checkScroll, gifts])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' })
  }

  if (giftsLoading) {
    return (
      <div className="flex gap-2 overflow-hidden px-1 py-0.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-shrink-0 w-48 h-10 bg-surface rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (gifts.length === 0) {
    return (
      <div className="flex items-center gap-3 px-1 py-2 text-sm text-muted">
        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0">
          <Gift className="h-5 w-5 text-primary/30" />
        </div>
        <span>No gifts yet. Ask the concierge to send one!</span>
      </div>
    )
  }

  return (
    <div className="relative group">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-0.5">
        {gifts.map(gift => {
          const status = STATUS_CONFIG[gift.status] || STATUS_CONFIG.PENDING
          const StatusIcon = status.icon
          return (
            <Link
              key={gift.id}
              href={gift.direction === 'received' ? `/gift/${gift.redeemCode}` : '#'}
              className="flex-shrink-0 flex items-center gap-2 bg-surface rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/30 transition"
            >
              {gift.itemImage ? (
                <img src={gift.itemImage} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center flex-shrink-0">
                  <Gift className="h-3.5 w-3.5 text-primary/40" />
                </div>
              )}
              <div className="min-w-0 max-w-[100px]">
                <p className="text-[11px] font-medium truncate leading-tight">{gift.itemName}</p>
                <p className="text-[9px] text-muted truncate">
                  {gift.direction === 'sent'
                    ? `To ${gift.recipientName || 'someone'}`
                    : `From ${gift.senderName || 'someone'}`
                  }
                </p>
              </div>
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium whitespace-nowrap ${status.color}`}>
                <StatusIcon className="h-2 w-2" />
                {status.label}
              </span>
              <span className="text-[11px] font-semibold whitespace-nowrap">${gift.amount.toFixed(0)}</span>
            </Link>
          )
        })}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/* ─── Main Page ─── */

export default function ChatPage() {
  const { messages, streaming, sendMessage, setInitialMessages } = useChatStream()
  const [loading, setLoading] = useState(true)
  const desktopScrollRef = useRef<HTMLDivElement>(null)
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const pendingQuerySent = useRef(false)
  const lastStreamedIdRef = useRef<string | null>(null)
  const initialScrollDone = useRef(false)

  // Gifts state
  const [allGifts, setAllGifts] = useState<GiftItem[]>([])
  const [giftsLoading, setGiftsLoading] = useState(true)

  // Activity state
  const [activities, setActivities] = useState<any[]>([])
  const [activityTab, setActivityTab] = useState<'mine' | 'community'>('community')
  const [activityLoading, setActivityLoading] = useState(true)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (desktopScrollRef.current) {
        desktopScrollRef.current.scrollTop = desktopScrollRef.current.scrollHeight
      }
      if (mobileScrollRef.current) {
        mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight
      }
    })
  }, [])

  // Load chat history
  useEffect(() => {
    fetch('/api/chat/history')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setInitialMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setInitialMessages])

  // Load gifts
  useEffect(() => {
    fetch('/api/gifts')
      .then(r => r.json())
      .then(data => {
        const sent = (data.sent || []).map((g: any) => ({ ...g, direction: 'sent' as const }))
        const received = (data.received || []).map((g: any) => ({ ...g, direction: 'received' as const }))
        // Interleave: most recent first
        const merged = [...sent, ...received].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setAllGifts(merged)
      })
      .catch(() => {})
      .finally(() => setGiftsLoading(false))
  }, [])

  // Load activity
  const fetchActivities = useCallback(async (tab: 'mine' | 'community') => {
    setActivityLoading(true)
    try {
      const res = await fetch(`/api/activity?tab=${tab}&limit=20`)
      const data = await res.json()
      setActivities((data.items || []).map(transformActivity))
    } catch {
      setActivities([])
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivities(activityTab)
  }, [activityTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send ?q= param
  useEffect(() => {
    if (loading || pendingQuerySent.current) return
    const q = searchParams.get('q')
    if (q) {
      pendingQuerySent.current = true
      sendMessage(q)
    }
  }, [loading, searchParams, sendMessage])

  // Scroll when virtual keyboard opens/closes
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => scrollToBottom()
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [scrollToBottom])

  // Track the actively streaming assistant message
  useEffect(() => {
    if (streaming) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'ASSISTANT') {
          lastStreamedIdRef.current = messages[i].id
          break
        }
      }
    }
  }, [streaming, messages])

  useEffect(() => {
    if (messages.length === 0) return
    if (!initialScrollDone.current) {
      initialScrollDone.current = true
      scrollToBottom()
    } else {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  if (loading) {
    return (
      <div className="lg:h-screen">
        <div className="p-4 lg:p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-gray-900">Gift Concierge</h1>
        </div>
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      </div>
    )
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center text-center">
      <MessageCircle className="h-12 w-12 text-gray-300 mb-3" />
      <p className="text-sm text-muted max-w-xs mb-5">
        Ask me for gift ideas, help deciding, or what&apos;s trending.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {defaultSuggestions.map((s) => (
          <SuggestionChip key={s} label={s} onClick={sendMessage} />
        ))}
      </div>
    </div>
  )

  const suggestionChips = messages.length > 0 && !streaming ? (
    defaultSuggestions.map((s) => (
      <SuggestionChip key={s} label={s} onClick={sendMessage} />
    ))
  ) : null

  const activityContent = (
    <>
      <div className="mb-3">
        <ActivityTabs activeTab={activityTab} onTabChange={setActivityTab} />
      </div>
      {activityLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted text-center py-4">
          {activityTab === 'mine' ? 'No activity yet.' : 'No community activity yet.'}
        </p>
      ) : (
        <div className="space-y-0">
          {activities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onAction={() => {}}
            />
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {/* ─── Desktop: two-column layout ─── */}
      <div className="hidden lg:flex fixed top-0 bottom-0 left-80 right-0 overflow-hidden bg-background z-10">
        {/* Left: Gifts carousel + Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Gifts carousel */}
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <div className="flex items-center justify-between mb-0.5">
              <h2 className="text-xs font-semibold text-gray-500 flex items-center gap-1 uppercase tracking-wide">
                <Gift className="h-3 w-3 text-primary" />
                Gifts
              </h2>
              <Link href="/gifts" className="text-[10px] text-primary hover:underline font-medium">
                View all
              </Link>
            </div>
            <GiftsCarousel gifts={allGifts} loading={giftsLoading} />
          </div>

          {/* Chat header */}
          <div className="py-3 px-6 border-b border-border flex-shrink-0">
            <h1 className="text-lg font-bold text-gray-900">Gift Concierge</h1>
          </div>

          {/* Chat messages */}
          <div ref={desktopScrollRef} className="chat-scroll flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">{emptyState}</div>
            ) : (
              messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  autoExecute={streaming && msg.id === lastStreamedIdRef.current}
                />
              ))
            )}
            <div />
          </div>

          {/* Suggestions + Input */}
          {suggestionChips && (
            <div className="px-4 py-1.5 flex gap-2 overflow-x-auto flex-shrink-0">
              {suggestionChips}
            </div>
          )}
          <div className="flex-shrink-0">
            <ChatInput onSend={sendMessage} disabled={streaming} />
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="w-72 border-l border-border flex-shrink-0 overflow-y-auto px-3 py-3">
          <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Activity</h2>
          {activityContent}
        </div>
      </div>

      {/* ─── Mobile: stacked layout ─── */}
      <div className="lg:hidden flex fixed inset-0 flex-col overflow-hidden bg-background z-10" style={{ height: '100dvh' }}>
        {/* Gifts carousel */}
        <div className="flex-shrink-0 border-b border-border px-4 py-2">
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="text-xs font-semibold text-gray-900 flex items-center gap-1">
              <Gift className="h-3.5 w-3.5 text-primary" />
              Gifts
            </h2>
            <Link href="/gifts" className="text-[10px] text-primary hover:underline font-medium">
              All
            </Link>
          </div>
          <GiftsCarousel gifts={allGifts} loading={giftsLoading} />
        </div>

        {/* Chat header */}
        <div className="p-3 px-4 border-b border-border flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-900">Gift Concierge</h1>
        </div>

        {/* Messages */}
        <div ref={mobileScrollRef} className="chat-scroll flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="pt-8">{emptyState}</div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                autoExecute={streaming && msg.id === lastStreamedIdRef.current}
              />
            ))
          )}
          <div />
        </div>

        {/* Suggestions + Input */}
        {suggestionChips && (
          <div className="px-4 py-1.5 flex gap-2 overflow-x-auto flex-shrink-0">
            {suggestionChips}
          </div>
        )}
        <div className="flex-shrink-0">
          <ChatInput onSend={sendMessage} disabled={streaming} onFocus={() => setTimeout(() => scrollToBottom(), 300)} />
        </div>
      </div>
    </>
  )
}
