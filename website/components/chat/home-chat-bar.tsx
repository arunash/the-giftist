'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, ArrowRight, Send } from 'lucide-react'
import { useChatStream } from '@/lib/hooks/use-chat-stream'
import { ChatBubble } from './chat-bubble'
import Link from 'next/link'

const quickSuggestions = [
  'Gift ideas under $50',
  'What should I buy next?',
  'Help me find a birthday gift',
]

export function HomeChatBar() {
  const [active, setActive] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const { messages, streaming, sendMessage, clearMessages } = useChatStream()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus()
    }
  }, [active])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && active) {
        handleDismiss()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active])

  const handleDismiss = () => {
    setActive(false)
    setInputValue('')
    clearMessages()
  }

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || streaming) return
    setActive(true)
    sendMessage(trimmed)
    setInputValue('')
  }

  const handleSuggestion = (text: string) => {
    setActive(true)
    sendMessage(text)
  }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* Backdrop */}
      {active && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={handleDismiss}
        />
      )}

      <div className={`relative ${active ? 'z-40' : ''}`}>
        {/* Search Bar */}
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 transition-all ${active ? 'rounded-b-none shadow-lg border-b-0' : ''}`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => !hasMessages && setActive(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask me anything about gifts..."
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
            />
            {(inputValue.trim() || active) && (
              <div className="flex items-center gap-1">
                {inputValue.trim() && (
                  <button
                    onClick={handleSubmit}
                    disabled={streaming}
                    className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
                {active && (
                  <button
                    onClick={handleDismiss}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Suggestions (when not active with messages) */}
          {!hasMessages && (
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
              {quickSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="px-3 py-1 text-xs text-primary border border-primary/20 rounded-full hover:bg-primary/5 transition whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expanded conversation area */}
        {active && hasMessages && (
          <div className="absolute left-0 right-0 bg-white border border-t-0 border-gray-200 rounded-b-2xl shadow-lg overflow-hidden z-40">
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-400">
                {streaming ? 'Thinking...' : `${messages.length} messages`}
              </span>
              <Link
                href="/chat"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition"
              >
                Continue in Chat
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
