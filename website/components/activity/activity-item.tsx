import { Avatar } from '@/components/ui/avatar'
import { formatPrice } from '@/lib/utils'
import {
  Plus,
  DollarSign,
  ShoppingBag,
  ArrowDownLeft,
  Heart,
  Calendar,
} from 'lucide-react'

interface ActivityItemProps {
  activity: {
    id: string
    type: string
    metadata: string | null
    createdAt: string
    user: { name: string | null; image: string | null }
    item?: { name: string | null; image: string | null; priceValue: number | null } | null
  }
}

const typeConfig: Record<string, { icon: any; color: string; label: (meta: any, item: any, userName: string) => string }> = {
  ITEM_ADDED: {
    icon: Plus,
    color: 'bg-blue-100 text-blue-600',
    label: (_, item, name) => `${name} added "${item?.name || 'an item'}"`,
  },
  ITEM_FUNDED: {
    icon: DollarSign,
    color: 'bg-green-100 text-green-600',
    label: (meta, item, name) => `${name} funded ${meta?.amount ? formatPrice(meta.amount) : ''} to "${item?.name || 'an item'}"`,
  },
  ITEM_PURCHASED: {
    icon: ShoppingBag,
    color: 'bg-purple-100 text-purple-600',
    label: (_, item, name) => `${name} purchased "${item?.name || 'an item'}"`,
  },
  WALLET_DEPOSIT: {
    icon: ArrowDownLeft,
    color: 'bg-emerald-100 text-emerald-600',
    label: (meta, _, name) => `${name} added ${meta?.amount ? formatPrice(meta.amount) : 'money'} to wallet`,
  },
  CONTRIBUTION_RECEIVED: {
    icon: Heart,
    color: 'bg-pink-100 text-pink-600',
    label: (meta, item, name) => `${name} received a ${meta?.amount ? formatPrice(meta.amount) : ''} contribution for "${item?.name || 'an item'}"`,
  },
  EVENT_CREATED: {
    icon: Calendar,
    color: 'bg-orange-100 text-orange-600',
    label: (meta, _, name) => `${name} created event "${meta?.eventName || ''}"`,
  },
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const meta = activity.metadata ? JSON.parse(activity.metadata) : {}
  const config = typeConfig[activity.type] || typeConfig.ITEM_ADDED
  const Icon = config.icon
  const userName = activity.user.name || 'Someone'

  const timeAgo = getTimeAgo(new Date(activity.createdAt))

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <Avatar name={activity.user.name} image={activity.user.image} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">
          {config.label(meta, activity.item, userName)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{timeAgo}</p>
      </div>
      <div className={`p-1.5 rounded-lg ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
