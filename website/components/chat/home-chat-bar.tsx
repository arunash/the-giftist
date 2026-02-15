'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const quickSuggestions = [
  'Gift ideas under $50',
  'What should I get next?',
  'Help me pick a birthday gift',
]

export function HomeChatBar() {
  const [inputValue, setInputValue] = useState('')
  const [proactiveGreeting, setProactiveGreeting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const greetingFetched = useRef(false)
  const router = useRouter()

  // Fetch proactive greeting on mount
  useEffect(() => {
    if (greetingFetched.current) return
    greetingFetched.current = true
    fetch('/api/chat/greeting')
      .then((r) => r.json())
      .then((data) => {
        if (data.greeting) {
          setProactiveGreeting(data.greeting)
        }
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
    <div className="ig-card !rounded-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-2">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 leading-tight">Gift Concierge</h3>
          <p className="text-xs text-muted mt-0.5">AI-powered assistant</p>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Ask me anything about gifts..."
          className="flex-1 text-sm text-gray-900 placeholder-muted outline-none bg-transparent"
        />
        {inputValue.trim() && (
          <button
            onClick={handleSubmit}
            className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Proactive greeting from concierge */}
      {proactiveGreeting && (
        <Link href="/chat" className="block mx-4 mb-3 px-3 py-3 bg-primary/5 border border-primary/10 rounded-xl hover:bg-primary/10 transition">
          <p className="text-xs text-secondary leading-relaxed">{proactiveGreeting}</p>
        </Link>
      )}

      {/* Suggestions */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
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
