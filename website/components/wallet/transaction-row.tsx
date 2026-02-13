import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface TransactionRowProps {
  transaction: {
    id: string
    type: string
    amount: number
    status: string
    description: string | null
    createdAt: string
    item?: { name: string; image: string | null } | null
  }
}

const typeIcons = {
  DEPOSIT: ArrowDownLeft,
  FUND_ITEM: ArrowUpRight,
  REFUND: RotateCcw,
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const Icon = typeIcons[transaction.type as keyof typeof typeIcons] || ArrowDownLeft
  const isPositive = transaction.amount > 0

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div
        className={`p-2 rounded-lg ${
          isPositive ? 'bg-success-light text-green-600' : 'bg-primary-light text-primary'
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {transaction.description || transaction.type}
        </p>
        <p className="text-xs text-gray-500">
          {new Date(transaction.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-gray-900'}`}>
          {isPositive ? '+' : ''}{formatPrice(Math.abs(transaction.amount))}
        </p>
        {transaction.status === 'PENDING' && (
          <Badge variant="warning">Pending</Badge>
        )}
      </div>
    </div>
  )
}
