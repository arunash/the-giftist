'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

const suggestions = [
  'Gift for mom under $50',
  'Birthday ideas for my partner',
  'Something unique for a coworker',
  'Help me plan a wedding registry',
]

export function HeroChatInput() {
  const [value, setValue] = useState('')
  const router = useRouter()

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    router.push(`/login?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 flex items-center gap-2 p-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(value)
          }}
          placeholder="My sister's birthday is coming up..."
          className="flex-1 px-4 py-3 text-base text-gray-900 placeholder-gray-400 bg-transparent outline-none"
        />
        <button
          onClick={() => submit(value)}
          disabled={!value.trim()}
          className="flex-shrink-0 flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-primary-hover transition disabled:opacity-40"
        >
          <span className="hidden sm:inline">Send</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            className="px-3.5 py-1.5 text-sm text-primary border border-primary/20 rounded-full hover:bg-primary/10 transition whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
