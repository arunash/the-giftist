'use client'

import { Gift } from 'lucide-react'
import { formatPrice, getProgressPercentage } from '@/lib/utils'

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
  }
  onFund?: (item: any) => void
}

export function ItemCard({ item }: ItemCardProps) {
  const goal = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goal)
  const isPartiallyFunded = item.fundedAmount > 0 && progress < 100

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] bg-gray-100">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift className="h-16 w-16 text-gray-200" />
          </div>
        )}

        {/* Glass price pill */}
        {item.price && (
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-sm font-semibold">
            {item.price}
          </div>
        )}

        {/* Purchased badge */}
        {item.isPurchased && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md text-xs font-semibold text-purple-600">
            Purchased
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-1">
          {item.name}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">{item.domain}</p>

        {/* Thin gradient progress bar — only if partially funded */}
        {isPartiallyFunded && !item.isPurchased && (
          <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </a>
  )
}
