'use client'

import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { daysUntil } from '@/lib/utils'

const EVENT_TYPE_EMOJI: Record<string, string> = {
  BIRTHDAY: '🎂',
  ANNIVERSARY: '💍',
  WEDDING: '💒',
  BABY_SHOWER: '👶',
  CHRISTMAS: '🎄',
  HOLIDAY: '🎉',
  GRADUATION: '🎓',
  OTHER: '📅',
}

function getAiSuggestion(event: EventCardProps['event']): { text: string; href: string } {
  const days = daysUntil(new Date(event.date))

  if (event.itemCount === 0) {
    return {
      text: 'No items yet! Want me to suggest gifts?',
      href: `/chat?q=${encodeURIComponent(`Help me find gift ideas for ${event.name}`)}`,
    }
  }
  if (event.fundedAmount === 0) {
    return {
      text: `${event.itemCount} items, $0 funded — share with your circle`,
      href: `/chat?q=${encodeURIComponent(`Help me share my ${event.name} wishlist to get it funded`)}`,
    }
  }
  if (days <= 7 && event.itemCount < 3) {
    return {
      text: 'Event is soon! Consider adding more gift ideas',
      href: `/chat?q=${encodeURIComponent(`Help me find more gift ideas for ${event.name}`)}`,
    }
  }
  return {
    text: 'Good start! Consider adding experience gifts',
    href: `/chat?q=${encodeURIComponent(`Show me experience gift ideas for ${event.name}`)}`,
  }
}

interface EventCardProps {
  event: {
    id: string
    name: string
    type: string
    date: string
    itemCount: number
    fundedAmount: number
    itemImages: string[]
  }
}

export function EventCard({ event }: EventCardProps) {
  const days = daysUntil(new Date(event.date))
  const firstImage = event.itemImages[0]
  const suggestion = getAiSuggestion(event)

  const countdownColor =
    days <= 7 ? 'bg-red-500 text-white' : days <= 30 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'

  const countdownText = days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days}d`

  return (
    <Link href={`/events/${event.id}`} className="ig-card group overflow-hidden block">
      {/* Thumbnail */}
      <div className="aspect-[16/9] relative overflow-hidden">
        {firstImage ? (
          <img src={firstImage} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <span className="text-5xl">{EVENT_TYPE_EMOJI[event.type] || '📅'}</span>
          </div>
        )}
        {/* Countdown badge */}
        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold ${countdownColor}`}>
          {countdownText}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{event.name}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <span>
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <span>&middot;</span>
          <span>{event.itemCount} item{event.itemCount !== 1 ? 's' : ''}</span>
          {event.fundedAmount > 0 && (
            <>
              <span>&middot;</span>
              <span className="text-emerald-600">${event.fundedAmount.toFixed(0)} funded</span>
            </>
          )}
        </div>

        {/* AI suggestion */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
          <span className="flex-shrink-0">✨</span>
          <span className="line-clamp-1">{suggestion.text}</span>
          <ArrowRight className="h-3 w-3 flex-shrink-0" />
        </div>
      </div>
    </Link>
  )
}

export function NewEventCard() {
  return (
    <Link
      href="/events/new"
      className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all min-h-[180px]"
    >
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-2 group-hover:bg-primary/10 transition">
        <Plus className="h-5 w-5 text-gray-300 group-hover:text-primary transition" />
      </div>
      <span className="text-sm font-medium text-gray-400 group-hover:text-gray-900 transition">
        New Event
      </span>
    </Link>
  )
}
