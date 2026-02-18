'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Send, Lightbulb } from 'lucide-react'
import { useRouter } from 'next/navigation'

const quickSuggestions = [
  'Gift ideas under $50',
  'Help me pick a gift',
  'What\'s trending?',
]

export function HomeChatBar() {
  const [inputValue, setInputValue] = useState('')
  const [insight, setInsight] = useState<string | null>(null)
  const fetched = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    fetch('/api/chat/greeting')
      .then((r) => r.json())
      .then((data) => {
        if (data.suggestion) setInsight(data.suggestion)
      })
      .catch(() => {})
  }, [])

  const navigateToChat = (message: string) => {
    router.push(`/chat?q=${encodeURIComponent(message)}`)
  }

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    navigateToChat(trimmed)
  }

  return (
    <div className="ig-card !rounded-2xl px-4 py-4">
      {/* Input row */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 flex items-center gap-2 bg-surface-hover rounded-full border border-border focus-within:border-primary px-3 py-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="Ask the Gift Concierge..."
            className="flex-1 text-sm text-gray-900 placeholder-muted placeholder:font-semibold outline-none bg-transparent"
          />
          {inputValue.trim() && (
            <button
              onClick={handleSubmit}
              className="p-1 rounded-full bg-primary text-white hover:bg-primary-hover transition"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* AI Insight */}
      {insight && (
        <button
          onClick={() => navigateToChat(`Tell me more: ${insight}`)}
          className="flex items-start gap-2 mt-3 px-3 py-2.5 w-full text-left bg-amber-50/60 border border-amber-200/40 rounded-xl hover:bg-amber-50 transition"
        >
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-secondary leading-relaxed line-clamp-2">{insight}</p>
        </button>
      )}

      {/* Quick suggestions */}
      <div className="flex gap-2 mt-3 overflow-x-auto">
        {quickSuggestions.map((s) => (
          <button
            key={s}
            onClick={() => navigateToChat(s)}
            className="px-3 py-1 text-xs text-primary border border-primary/20 rounded-full hover:bg-primary/10 transition whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
