'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <div className="px-3 py-2 bg-surface border-t border-border">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        className="flex items-center bg-surface-hover rounded-full border border-border focus-within:border-primary"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about your wishlist..."
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder-muted focus:outline-none disabled:opacity-50 py-2.5 pl-4 pr-2 rounded-l-full"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="p-2 m-1 rounded-full bg-primary text-white hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
