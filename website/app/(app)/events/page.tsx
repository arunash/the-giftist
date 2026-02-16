'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { daysUntil } from '@/lib/utils'
import { Plus, Calendar, Search, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import EventCardActions from './EventCardActions'

type EventWithItems = {
  id: string
  name: string
  type: string
  date: string
  items: { item: { id: string; name: string; image: string | null } }[]
}

const eventTypeLabels: Record<string, string> = {
  BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary',
  WEDDING: 'Wedding',
  BABY_SHOWER: 'Baby Shower',
  CHRISTMAS: 'Christmas',
  HOLIDAY: 'Holiday',
  OTHER: 'Event',
}

const sorts = [
  { value: 'date-asc', label: 'Soonest' },
  { value: 'date-desc', label: 'Latest' },
  { value: 'name-asc', label: 'A\u2013Z' },
]

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [localSearch, setLocalSearch] = useState('')
  const [sort, setSort] = useState('date-asc')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleSearchInput(value: string) {
    setLocalSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
    }, 300)
  }

  const filtered = useMemo(() => {
    let result = events

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((e) => e.name.toLowerCase().includes(q))
    }

    result = [...result].sort((a, b) => {
      if (sort === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime()
      if (sort === 'name-asc') return a.name.localeCompare(b.name)
      return new Date(a.date).getTime() - new Date(b.date).getTime() // date-asc default
    })

    return result
  }, [events, search, sort])

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <Link
            href="/events/new"
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition text-sm"
          >
            <Plus className="h-4 w-4" />
            New Event
          </Link>
        </div>

        {/* Search + Sort */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-gray-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>
          <div className="flex gap-2">
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-16 w-16" />}
            title="No events yet"
            description="Create an event for your birthday, wedding, or any occasion to start collecting gifts."
            action={
              <Link
                href="/events/new"
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary-hover transition"
              >
                <Plus className="h-4 w-4" />
                Create Event
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted py-12">No events match &ldquo;{search}&rdquo;</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((event) => {
              const days = daysUntil(event.date)
              return (
                <div
                  key={event.id}
                  className="bg-surface rounded-xl p-5 border border-border hover:border-border-light transition relative"
                >
                  <Link
                    href={`/events/${event.id}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-medium text-accent uppercase">
                          {eventTypeLabels[event.type] || 'Event'}
                        </span>
                        <h3 className="font-semibold text-gray-900 mt-1 text-lg">{event.name}</h3>
                        <p className="text-sm text-muted mt-1">
                          {new Date(event.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-muted mt-1">
                          {event.items.length} item{event.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span
                          className={`text-sm font-medium px-3 py-1 rounded-full ${
                            days <= 7
                              ? 'bg-red-500/10 text-red-400'
                              : days <= 30
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : days < 0
                              ? 'bg-surface-hover text-muted'
                              : 'bg-green-500/10 text-green-600'
                          }`}
                        >
                          {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : days < 0 ? 'Passed' : `${days} days`}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <EventCardActions eventId={event.id} eventName={event.name} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
