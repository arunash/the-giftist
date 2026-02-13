'use client'

import { cn } from '@/lib/utils'

interface ItemFiltersProps {
  filter: string
  sort: string
  category: string
  categories: string[]
  onFilterChange: (f: string) => void
  onSortChange: (s: string) => void
  onCategoryChange: (c: string) => void
}

const filters = [
  { value: 'all', label: 'All' },
  { value: 'unfunded', label: 'Unfunded' },
  { value: 'funded', label: 'Funded' },
  { value: 'purchased', label: 'Purchased' },
]

export function ItemFilters({
  filter,
  sort,
  category,
  categories,
  onFilterChange,
  onSortChange,
  onCategoryChange,
}: ItemFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition',
              filter === f.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Category and sort */}
      <div className="flex gap-3">
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price-high">Price: High to Low</option>
          <option value="price-low">Price: Low to High</option>
        </select>
      </div>
    </div>
  )
}
