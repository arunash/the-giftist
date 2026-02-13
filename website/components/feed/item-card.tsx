'use client'

import { ExternalLink, Gift, TrendingDown } from 'lucide-react'
import { formatPrice, getProgressPercentage } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface ItemCardProps {
  item: {
    id: string
    name: string
    price: string | null
    priceValue: number | null
    image: string | null
    url: string
    domain: string
    category: string | null
    source: string
    fundedAmount: number
    goalAmount: number | null
    isPurchased: boolean
    priceHistory?: { price: number }[]
  }
  onFund?: (item: any) => void
}

const sourceLabels: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EXTENSION: 'Extension',
  MANUAL: 'Manual',
  CHAT: 'AI Chat',
}

export function ItemCard({ item, onFund }: ItemCardProps) {
  const hasPriceDrop =
    item.priceHistory &&
    item.priceHistory.length >= 2 &&
    item.priceValue !== null &&
    item.priceValue < item.priceHistory[0].price

  const goal = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goal)
  const remaining = Math.max(0, goal - item.fundedAmount)

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition group">
      {/* Image */}
      <div className="relative h-40 bg-gray-50">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift className="h-12 w-12 text-gray-200" />
          </div>
        )}
        {hasPriceDrop && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-success text-white text-xs font-semibold px-2 py-1 rounded-full">
            <TrendingDown className="h-3 w-3" />
            Price Drop
          </div>
        )}
        {item.isPurchased && (
          <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
            Purchased
          </div>
        )}
        {/* Domain badge */}
        <div className="absolute bottom-2 left-2">
          <Badge variant="outline" className="bg-white/90 backdrop-blur-sm text-[10px]">
            {item.domain}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-secondary line-clamp-2 text-sm mb-1">
          {item.name}
        </h3>
        <div className="flex items-center gap-2 mb-2">
          <p className={`font-bold text-lg ${hasPriceDrop ? 'text-success' : 'text-primary'}`}>
            {item.price || 'No price'}
          </p>
          {item.source && item.source !== 'MANUAL' && (
            <Badge variant="default" className="text-[10px]">
              {sourceLabels[item.source] || item.source}
            </Badge>
          )}
        </div>

        {/* Funding progress */}
        {goal > 0 && !item.isPurchased && (
          <div className="mb-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formatPrice(item.fundedAmount)} of {formatPrice(goal)}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View
          </a>
          {!item.isPurchased && remaining > 0 && onFund && (
            <button
              onClick={() => onFund(item)}
              className="flex-1 text-sm font-medium text-white bg-primary hover:bg-primary-hover py-2 rounded-lg transition"
            >
              Fund
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
