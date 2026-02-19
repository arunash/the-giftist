'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, Gift, Pencil } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatPrice, getProgressPercentage } from '@/lib/utils'
import ContributeButton from './ContributeButton'
import ShareItemButton from './ShareItemButton'

interface EventItem {
  id: string
  name: string
  image: string | null
  url: string | null
  priceValue: number | null
  goalAmount: number | null
  fundedAmount: number
  isPurchased: boolean
  contributions: {
    id: string
    amount: number
    isAnonymous: boolean
    contributor: { name: string | null } | null
  }[]
}

interface EventItemsGridProps {
  items: EventItem[]
  ownerName: string
  isOwner: boolean
}

const sorts = [
  { value: 'default', label: 'Default' },
  { value: 'name-az', label: 'Name A–Z' },
  { value: 'price-high', label: 'Price ↓' },
  { value: 'price-low', label: 'Price ↑' },
]

type BadgeInfo = {
  label: string
  color: string
}

function getItemBadge(item: EventItem, allItems: EventItem[]): BadgeInfo | null {
  const goal = item.goalAmount || item.priceValue || 0
  if (goal <= 0 || item.isPurchased) return null

  const progress = getProgressPercentage(item.fundedAmount, goal)
  const isFullyFunded = item.fundedAmount >= goal

  // "Almost There" — funded >75% but not 100%
  if (progress > 75 && !isFullyFunded) {
    return { label: 'Almost There', color: 'bg-amber-500 text-white' }
  }

  // "Most Wanted" — most funded by dollar amount (not fully funded)
  const unfundedItems = allItems.filter((i) => {
    const g = i.goalAmount || i.priceValue || 0
    return g > 0 && !i.isPurchased && i.fundedAmount < g && i.fundedAmount > 0
  })
  if (unfundedItems.length > 1) {
    const maxFunded = Math.max(...unfundedItems.map((i) => i.fundedAmount))
    if (item.fundedAmount === maxFunded && item.fundedAmount > 0 && !isFullyFunded) {
      return { label: 'Most Wanted', color: 'bg-primary text-white' }
    }
  }

  // "Best Value" — lowest price among items with a goal
  const itemsWithGoal = allItems.filter((i) => {
    const g = i.goalAmount || i.priceValue || 0
    return g > 0 && !i.isPurchased
  })
  if (itemsWithGoal.length > 1) {
    const lowestGoal = Math.min(...itemsWithGoal.map((i) => i.goalAmount || i.priceValue || 0))
    if (goal === lowestGoal && goal > 0) {
      return { label: 'Best Value', color: 'bg-emerald-500 text-white' }
    }
  }

  return null
}

export default function EventItemsGrid({ items, ownerName, isOwner }: EventItemsGridProps) {
  const [search, setSearch] = useState('')
  const [localSearch, setLocalSearch] = useState('')
  const [sort, setSort] = useState('default')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  function handleSearchInput(value: string) {
    setLocalSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
    }, 300)
  }

  const filtered = useMemo(() => {
    let result = items

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((item) => item.name.toLowerCase().includes(q))
    }

    if (sort === 'name-az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'price-high') {
      result = [...result].sort((a, b) => (b.goalAmount || b.priceValue || 0) - (a.goalAmount || a.priceValue || 0))
    } else if (sort === 'price-low') {
      result = [...result].sort((a, b) => (a.goalAmount || a.priceValue || 0) - (b.goalAmount || b.priceValue || 0))
    }

    return result
  }, [items, search, sort])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search items..."
            className="w-48 sm:w-56 pl-9 pr-3 py-1.5 rounded-full border border-border bg-surface text-sm text-gray-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>
        <span className="w-px h-6 bg-border self-center mx-0.5" />
        {sorts.map((s) => (
          <button
            key={s.value}
            onClick={() => setSort(s.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              sort === s.value
                ? 'bg-gray-900 text-white'
                : 'bg-surface text-muted hover:text-gray-900 border border-border'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl p-12 text-center border border-border">
          <Gift className="h-16 w-16 text-[#333] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {search ? 'No matching items' : 'No items added yet'}
          </h3>
          <p className="text-muted">
            {search ? 'Try a different search term.' : 'Check back later for wishlist items!'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} ownerName={ownerName} isOwner={isOwner} allItems={items} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, ownerName, isOwner, allItems }: { item: EventItem; ownerName: string; isOwner: boolean; allItems: EventItem[] }) {
  const goalAmount = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goalAmount)
  const remaining = Math.max(0, goalAmount - item.fundedAmount)
  const isFullyFunded = item.fundedAmount >= goalAmount
  const isPurchased = item.isPurchased

  const badge = getItemBadge(item, allItems)

  return (
    <div className="bg-surface rounded-xl overflow-hidden border border-border">
      <Link href={`/items/${item.id}`} className="block relative h-48 bg-surface-hover">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift className="h-16 w-16 text-[#333]" />
          </div>
        )}
        {isPurchased && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-success text-white px-4 py-2 rounded-lg font-semibold">
              Purchased!
            </span>
          </div>
        )}
        {!isPurchased && isFullyFunded && (
          <div className="absolute top-3 right-3 bg-success text-white px-3 py-1 rounded-full text-sm font-semibold">
            Fully Funded!
          </div>
        )}
        {/* Smart Priority Badge */}
        {badge && !isPurchased && !isFullyFunded && (
          <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
            {badge.label}
          </div>
        )}
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2">
            {item.name}
          </h3>
          {isOwner && (
            <Link
              href={`/items/${item.id}`}
              className="flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-gray-900 hover:bg-surface-hover transition-colors"
              title="View & edit item"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
        <p className="text-xl font-bold text-primary">
          {item.goalAmount && item.priceValue && item.goalAmount > item.priceValue
            ? formatPrice(item.priceValue)
            : formatPrice(goalAmount)}
        </p>
        {item.goalAmount && item.priceValue && item.goalAmount > item.priceValue && (
          <p className="text-xs text-muted mb-3">+ {formatPrice(item.goalAmount - item.priceValue)} fee</p>
        )}
        {!(item.goalAmount && item.priceValue && item.goalAmount > item.priceValue) && (
          <div className="mb-3" />
        )}

        <div className="mb-3">
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isFullyFunded ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">
              {formatPrice(item.fundedAmount)} funded
            </span>
            <span className="text-muted">{progress}%</span>
          </div>
        </div>

        {item.contributions.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted mb-1">Contributors:</p>
            <div className="flex flex-wrap gap-1">
              {item.contributions.slice(0, 5).map((c) => (
                <span
                  key={c.id}
                  className="text-xs bg-surface-hover text-muted px-2 py-1 rounded"
                >
                  {c.isAnonymous
                    ? 'Anonymous'
                    : c.contributor?.name || 'Someone'}{' '}
                  ({formatPrice(c.amount)})
                </span>
              ))}
              {item.contributions.length > 5 && (
                <span className="text-xs text-muted">
                  +{item.contributions.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isPurchased && !isFullyFunded && (
            <ContributeButton
              itemId={item.id}
              itemName={item.name}
              remaining={remaining}
              ownerName={ownerName}
            />
          )}
          <ShareItemButton itemId={item.id} ownerName={ownerName} />
        </div>
      </div>
    </div>
  )
}
