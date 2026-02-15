'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Gift, ExternalLink, Share2, Check, Trash2, Calendar, Heart } from 'lucide-react'
import { formatPrice, getProgressPercentage, shareOrCopy, giftistShareText } from '@/lib/utils'
import { applyAffiliateTag } from '@/lib/affiliate'

interface EventOption {
  id: string
  name: string
}

interface ItemEvent {
  event: { id: string; name: string; type: string }
}

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
    eventItems?: ItemEvent[]
  }
  ownerName?: string
  onFund?: (item: any) => void
  onRemove?: (id: string) => void
  events?: EventOption[]
}

const WHATSAPP_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER || ''

export function ItemCard({ item, ownerName, onFund, onRemove, events }: ItemCardProps) {
  const goal = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goal)
  const isFullyFunded = progress >= 100 || item.isPurchased
  const hasFunding = item.fundedAmount > 0
  const [copied, setCopied] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState('')
  const [imgBroken, setImgBroken] = useState(false)

  const itemShareLink = `https://wa.me/15014438478?text=${encodeURIComponent(`👋 Tap send to check out a gift from ${ownerName || 'your friend'}'s wishlist on The Giftist!\n\nitem ${item.id}`)}`

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const didShare = await shareOrCopy(
      itemShareLink,
      item.name,
      giftistShareText(ownerName || 'Your friend')
    )
    if (didShare) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Remove this item from your wishlist?')) return
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
      if (res.ok) onRemove?.(item.id)
    } catch {}
  }

  const handleEventChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const eventId = e.target.value
    setSelectedEvent(eventId)
    try {
      await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: eventId || null }),
      })
    } catch {}
  }

  const itemEvent = item.eventItems?.[0]?.event

  const socialProof = isFullyFunded
    ? null
    : item.priceValue && item.priceValue < 30
      ? { emoji: '💫', text: 'Budget-friendly pick' }
      : hasFunding && progress >= 50
        ? { emoji: '🔥', text: `${Math.min(progress, 99)}% funded` }
        : null

  const affiliateUrl = applyAffiliateTag(item.url)

  // Never show items without a working image
  if (!item.image || imgBroken) return null

  return (
    <div className="ig-card group relative cursor-pointer overflow-hidden">
      <Link href={`/items/${item.id}`}>
        {/* Image */}
        <div className="ig-image-wrap aspect-square">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={() => setImgBroken(true)}
          />

          {/* Glass price pill */}
          {item.price && (
            <div className="absolute bottom-3 left-3 ig-glass px-3 py-1.5 rounded-full text-white text-sm font-semibold z-10">
              {item.price}
            </div>
          )}

          {/* FUNDED badge */}
          {isFullyFunded && (
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-500 text-xs font-bold text-white uppercase tracking-wide z-10">
              Funded
            </div>
          )}

          {/* Hover overlay */}
          <div className="ig-overlay absolute inset-0 z-20 flex flex-col justify-end p-3">
            {/* Store link */}
            <div className="flex items-center gap-1 text-white/80 text-xs mb-2">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{item.domain}</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs hover:bg-white/30 transition"
              >
                {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                {copied ? 'Shared!' : 'Share'}
              </button>
              {onRemove && (
                <button
                  onClick={handleRemove}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs hover:bg-red-500/50 transition ml-auto"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Event dropdown */}
            {events && events.length > 0 && (
              <div className="mt-2" onClick={(e) => e.preventDefault()}>
                <select
                  value={selectedEvent}
                  onChange={handleEventChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-full px-3 py-1.5 outline-none appearance-none cursor-pointer"
                >
                  <option value="" className="text-gray-900 bg-white">No event</option>
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id} className="text-gray-900 bg-white">
                      {evt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
            {item.name}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{item.domain}</p>

          {/* Event label */}
          {itemEvent && (
            <Link
              href={`/events/${itemEvent.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-primary-light text-primary text-[10px] font-medium rounded-full hover:bg-primary/20 transition"
            >
              <Calendar className="h-2.5 w-2.5" />
              {itemEvent.name}
            </Link>
          )}

          {/* Funding progress — only show when there's actual funding */}
          {goal > 0 && hasFunding && !isFullyFunded && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400">
                  ${item.fundedAmount.toFixed(0)} funded
                </span>
                <span className="text-gray-400">
                  {progress}%
                </span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress >= 50
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : 'bg-gradient-to-r from-primary to-orange-400'
                  }`}
                  style={{ width: `${Math.max(progress, 2)}%` }}
                />
              </div>
            </div>
          )}

          {/* Social proof */}
          {socialProof && (
            <p className="mt-1.5 text-[11px] text-primary font-medium">
              {socialProof.emoji} {socialProof.text}
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
