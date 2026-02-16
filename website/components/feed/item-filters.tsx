'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ItemFiltersProps {
  filter: string
  onFilterChange: (f: string) => void
  sort: string
  onSortChange: (s: string) => void
  search: string
  onSearchChange: (q: string) => void
  mode?: 'items' | 'events'
}

const filters = [
  { value: 'all', label: 'All' },
  { value: 'unfunded', label: 'Wishlist' },
  { value: 'funded', label: 'Funded' },
]

const itemSorts = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price-high', label: 'Price ↓' },
  { value: 'price-low', label: 'Price ↑' },
]

const eventSorts = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

export function ItemFilters({ filter, onFilterChange, sort, onSortChange, search, onSearchChange, mode = 'items' }: ItemFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  function handleSearchInput(value: string) {
    setLocalSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 300)
  }

  const sorts = mode === 'events' ? eventSorts : itemSorts

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder={mode === 'events' ? 'Search events...' : 'Search items...'}
          className="w-48 sm:w-56 pl-9 pr-3 py-1.5 rounded-full border border-border bg-surface text-sm text-gray-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
        />
      </div>
      {mode === 'items' && (
        <>
          <span className="w-px h-6 bg-border self-center mx-0.5" />
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                filter === f.value
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted hover:text-gray-900 border border-border'
              )}
            >
              {f.label}
            </button>
          ))}
        </>
      )}
      <span className="w-px h-6 bg-border self-center mx-0.5" />
      {sorts.map((s) => (
        <button
          key={s.value}
          onClick={() => onSortChange(s.value)}
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
  )
}
