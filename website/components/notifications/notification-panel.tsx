'use client'

import { useState, useEffect, useCallback } from 'react'
import { NotificationItem } from './notification-item'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  metadata: string | null
  read: boolean
  createdAt: string
}

interface NotificationPanelProps {
  onClose: () => void
  onUnreadCountChange: (count: number) => void
}

export function NotificationPanel({ onClose, onUnreadCountChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchNotifications = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: '20' })
    if (cursor) params.set('cursor', cursor)
    const res = await fetch(`/api/notifications?${params}`)
    if (!res.ok) return
    const data = await res.json()
    if (cursor) {
      setNotifications((prev) => [...prev, ...data.notifications])
    } else {
      setNotifications(data.notifications)
    }
    setNextCursor(data.nextCursor)
    onUnreadCountChange(data.unreadCount)
  }, [onUnreadCountChange])

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false))
  }, [fetchNotifications])

  const handleMarkRead = async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id && !n.read)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    if (wasUnread) {
      const currentUnread = notifications.filter((n) => !n.read).length
      onUnreadCountChange(Math.max(0, currentUnread - 1))
    }
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: [id] }),
    })
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    onUnreadCountChange(0)
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    await fetchNotifications(nextCursor)
    setLoadingMore(false)
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-primary hover:text-primary-hover font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-2xl mb-2">🔔</p>
            <p className="text-sm text-gray-500">No notifications yet</p>
          </div>
        ) : (
          <>
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={handleMarkRead}
              />
            ))}
            {nextCursor && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 text-xs text-primary hover:bg-gray-50 font-medium transition-colors"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
