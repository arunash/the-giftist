'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'

const DISMISS_KEY = 'giftist-nudge-dismissed'

export function AiNudgeBanner() {
  const [nudge, setNudge] = useState<{ text: string; action?: string; href?: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Dismiss lasts 24 hours
      if (Date.now() < parsed.expiresAt) {
        setDismissed(true)
        return
      }
    }

    fetch('/api/ai-summary')
      .then((r) => r.json())
      .then((data) => {
        // Pick the first card with an action (skip greeting card)
        const actionCard = (data.cards || []).find(
          (c: any) => c.action && c.href
        )
        if (actionCard) {
          setNudge({ text: actionCard.text, action: actionCard.action, href: actionCard.href })
        }
      })
      .catch(() => {})
  }, [])

  if (dismissed || !nudge) return null

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
    )
  }

  return (
    <div className="relative rounded-xl bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 border border-pink-200/50 p-4 mb-6">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-700 leading-relaxed">{nudge.text}</p>
          {nudge.action && nudge.href && (
            <Link
              href={nudge.href}
              className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-primary hover:text-primary-hover transition"
            >
              {nudge.action} &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
