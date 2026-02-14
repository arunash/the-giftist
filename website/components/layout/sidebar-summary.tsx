'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

interface SummaryCard {
  emoji: string
  text: string
  href?: string
  action?: string
}

export function SidebarSummary() {
  const [cards, setCards] = useState<SummaryCard[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let retries = 0
    const fetchSummary = () => {
      fetch('/api/ai-summary')
        .then((r) => {
          if (r.status === 401 && retries < 2) {
            // Session not ready yet — retry after a short delay
            retries++
            setTimeout(fetchSummary, 1500)
            return null
          }
          return r.json()
        })
        .then((data) => {
          if (!data) return
          setCards(data.cards || [])
          setUpdatedAt(data.updatedAt || null)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
    fetchSummary()
  }, [])

  if (loading) {
    return (
      <div className="mx-4 mb-4">
        <div className="animate-pulse space-y-2 p-3">
          <div className="h-3 bg-surface-hover rounded w-2/3" />
          <div className="h-8 bg-surface-hover rounded" />
          <div className="h-8 bg-surface-hover rounded" />
        </div>
      </div>
    )
  }

  if (cards.length === 0) return null

  const timeLabel = updatedAt ? formatUpdatedAt(updatedAt) : ''

  return (
    <div className="mx-4 mb-4">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-white">Giftist Ticker</span>
      </div>
      {timeLabel && (
        <p className="text-[10px] text-muted px-1 mb-2">Updated {timeLabel}</p>
      )}
      <div className="space-y-1.5">
        {cards.map((card, i) => {
          const content = (
            <div className="px-3 py-2 rounded-lg bg-surface-hover/50 hover:bg-surface-hover transition">
              <div className="flex items-start gap-2 text-xs text-secondary leading-relaxed">
                <span className="shrink-0 mt-0.5">{card.emoji}</span>
                <span dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }} />
              </div>
              {card.action && (
                <Link
                  href="/chat"
                  className="mt-1.5 ml-5 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary-hover transition"
                >
                  {card.action}
                  <span className="text-[8px]">&rarr;</span>
                </Link>
              )}
            </div>
          )

          if (card.href) {
            return (
              <Link key={i} href={card.href} className="block">
                <div className="px-3 py-2 rounded-lg bg-surface-hover/50 hover:bg-surface-hover transition">
                  <div className="flex items-start gap-2 text-xs text-secondary leading-relaxed">
                    <span className="shrink-0 mt-0.5">{card.emoji}</span>
                    <span dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }} />
                  </div>
                </div>
              </Link>
            )
          }
          return <div key={i}>{content}</div>
        })}
      </div>
    </div>
  )
}

function formatUpdatedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatCardText(text: string): string {
  // Bold text wrapped in * (e.g. *Taylor's birthday*)
  return text.replace(/\*([^*]+)\*/g, '<strong class="text-primary">$1</strong>')
}
