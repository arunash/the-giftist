'use client'

import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  metadata: string | null
  read: boolean
  createdAt: string
}

const TYPE_CONFIG: Record<string, { emoji: string; color: string; href?: (meta: any) => string }> = {
  WELCOME: { emoji: '👋', color: 'bg-blue-500/20' },
  ITEM_ADDED: { emoji: '🎁', color: 'bg-red-500/20', href: (m) => m?.itemId ? `/items/${m.itemId}` : '/feed' },
  ITEM_EDITED: { emoji: '✏️', color: 'bg-orange-500/20', href: (m) => m?.itemId ? `/items/${m.itemId}` : '/feed' },
  ITEM_DELETED: { emoji: '🗑️', color: 'bg-gray-500/20' },
  ITEM_PURCHASED: { emoji: '🎉', color: 'bg-emerald-500/20', href: (m) => m?.itemId ? `/items/${m.itemId}` : '/feed' },
  EVENT_CREATED: { emoji: '📅', color: 'bg-purple-500/20', href: (m) => m?.eventId ? `/events/${m.eventId}` : '/feed' },
  EVENT_EDITED: { emoji: '📝', color: 'bg-indigo-500/20', href: (m) => m?.eventId ? `/events/${m.eventId}` : '/feed' },
  EVENT_DELETED: { emoji: '🗓️', color: 'bg-gray-500/20' },
  CONTRIBUTION_COMPLETED: { emoji: '💳', color: 'bg-amber-500/20', href: () => '/wallet' },
  CONTRIBUTION_RECEIVED: { emoji: '💝', color: 'bg-pink-500/20', href: () => '/wallet' },
  WITHDRAWAL: { emoji: '💰', color: 'bg-green-500/20', href: () => '/wallet' },
  FUNDS_ALLOCATED: { emoji: '📦', color: 'bg-teal-500/20', href: (m) => m?.itemId ? `/items/${m.itemId}` : '/wallet' },
  FUNDS_MOVED: { emoji: '🔄', color: 'bg-cyan-500/20', href: () => '/wallet' },
  THANK_YOU_SENT: { emoji: '🙏', color: 'bg-rose-500/20' },
  LIST_VIEWED: { emoji: '👀', color: 'bg-violet-500/20', href: () => '/feed' },
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const router = useRouter()
  const config = TYPE_CONFIG[notification.type] || { emoji: '🔔', color: 'bg-gray-500/20' }
  const meta = notification.metadata ? JSON.parse(notification.metadata) : null

  const handleClick = () => {
    if (!notification.read) onMarkRead(notification.id)
    const href = config.href?.(meta)
    if (href) router.push(href)
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <div className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <span className="text-sm">{config.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug">{notification.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.body}</p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
      )}
    </button>
  )
}
