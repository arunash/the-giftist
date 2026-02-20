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

// Curated Unsplash photos for each event type (free to use, reliable CDN)
const EVENT_TYPE_IMAGE: Record<string, string> = {
  BIRTHDAY: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=600&h=340&fit=crop',
  ANNIVERSARY: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&h=340&fit=crop',
  WEDDING: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=340&fit=crop',
  BABY_SHOWER: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&h=340&fit=crop',
  CHRISTMAS: 'https://images.unsplash.com/photo-1512389142860-9c449e58a814?w=600&h=340&fit=crop',
  HOLIDAY: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&h=340&fit=crop',
  GRADUATION: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&h=340&fit=crop',
  OTHER: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&h=340&fit=crop',
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
        <img
          src={firstImage || EVENT_TYPE_IMAGE[event.type] || EVENT_TYPE_IMAGE.OTHER}
          alt={event.name}
          className="w-full h-full object-cover"
        />
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
