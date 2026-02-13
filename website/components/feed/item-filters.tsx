'use client'

import { cn } from '@/lib/utils'

interface ItemFiltersProps {
  filter: string
  onFilterChange: (f: string) => void
}

const filters = [
  { value: 'all', label: 'All' },
  { value: 'unfunded', label: 'Wishlist' },
  { value: 'funded', label: 'Funded' },
]

export function ItemFilters({ filter, onFilterChange }: ItemFiltersProps) {
  return (
    <div className="flex gap-2">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onFilterChange(f.value)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
            filter === f.value
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-white text-gray-500 hover:text-gray-900 hover:shadow-sm'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
