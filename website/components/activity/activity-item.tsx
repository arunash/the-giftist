import { formatPrice } from '@/lib/utils'

interface ActivityItemProps {
  activity: {
    id: string
    type: string
    userName: string
    action: string
    emoji: string
    amount: number | null
    timeAgo: string
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const isPositive = activity.type === 'ITEM_FUNDED' || activity.type === 'CONTRIBUTION_RECEIVED'

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-lg flex-shrink-0">{activity.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{activity.userName}</span>{' '}
          {activity.action}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{activity.timeAgo}</p>
      </div>
      {activity.amount !== null && (
        <span className={`text-sm font-semibold flex-shrink-0 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
          {isPositive ? '+' : '-'}{formatPrice(activity.amount)}
        </span>
      )}
    </div>
  )
}
