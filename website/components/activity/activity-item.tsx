'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { Gift, Plus } from 'lucide-react'

interface ActivityItemProps {
  activity: {
    id: string
    type: string
    userName: string
    action: string
    emoji: string
    amount: number | null
    timeAgo: string
    itemName?: string | null
    itemPrice?: string | null
    itemImage?: string | null
    itemUrl?: string | null
    itemDomain?: string | null
    contextBadge?: string | null
  }
}

const AVATAR_COLORS: Record<string, string> = {
  ITEM_ADDED: 'bg-red-500/20',
  ITEM_FUNDED: 'bg-amber-500/20',
  ITEM_PURCHASED: 'bg-emerald-500/20',
  WALLET_DEPOSIT: 'bg-blue-500/20',
  CONTRIBUTION_RECEIVED: 'bg-pink-500/20',
  EVENT_CREATED: 'bg-purple-500/20',
  EVENT_ITEM_ADDED: 'bg-indigo-500/20',
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const isPositive = activity.type === 'ITEM_FUNDED' || activity.type === 'CONTRIBUTION_RECEIVED'
  const hasItem = !!activity.itemName
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const handleAddToList = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!activity.itemUrl || adding || added) return
    setAdding(true)
    try {
      const res = await fetch('/api/items/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activity.itemUrl, source: 'MANUAL' }),
      })
      if (res.ok) setAdded(true)
    } catch {}
    setAdding(false)
  }

  const avatarColor = AVATAR_COLORS[activity.type] || 'bg-surface-hover'

  return (
    <div className="group/activity relative">
      <div className="flex items-start gap-3 py-3">
        {/* Colored emoji avatar */}
        <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
          <span className="text-sm">{activity.emoji}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-secondary leading-snug">
            <span className="font-semibold text-white">{activity.userName}</span>{' '}
            {activity.action}
          </p>
          <p className="text-xs text-muted mt-0.5">{activity.timeAgo}</p>
        </div>

        {/* Amount */}
        {activity.amount !== null && (
          <span className={`text-sm font-semibold flex-shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : '-'}{formatPrice(activity.amount)}
          </span>
        )}
      </div>

      {/* Contextual badge */}
      {activity.contextBadge && (
        <div className="ml-11 -mt-1 mb-2">
          <span className="inline-block text-xs text-primary bg-primary/10 rounded-lg px-2.5 py-1">
            {activity.contextBadge}
          </span>
        </div>
      )}

      {/* Hover popover */}
      {hasItem && (
        <div className="absolute left-0 right-0 top-full z-30 hidden group-hover/activity:block">
          <div className="mt-1 bg-surface-raised rounded-xl border border-border p-3 flex gap-3">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-hover flex-shrink-0">
              {activity.itemImage ? (
                <img
                  src={activity.itemImage}
                  alt={activity.itemName || ''}
                  className="w-full h-full object-cover saturate-[1.1] contrast-[1.05] brightness-[1.02]"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Gift className="h-5 w-5 text-[#333]" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white line-clamp-1">{activity.itemName}</p>
              {activity.itemPrice && (
                <p className="text-xs font-semibold text-primary mt-0.5">{activity.itemPrice}</p>
              )}
              {activity.itemDomain && (
                <p className="text-xs text-muted mt-0.5">{activity.itemDomain}</p>
              )}
              {activity.itemUrl && (
                <button
                  onClick={handleAddToList}
                  disabled={adding || added}
                  className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {added ? 'Added!' : adding ? 'Adding...' : 'Add to my list'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
