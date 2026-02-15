'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, ArrowRight, Send } from 'lucide-react'
import { useChatStream } from '@/lib/hooks/use-chat-stream'
import { ChatBubble } from './chat-bubble'
import Link from 'next/link'

const quickSuggestions = [
  'Gift ideas under $50',
  'What should I get next?',
  'Help me pick a birthday gift',
]

export function HomeChatBar() {
  const [active, setActive] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [proactiveGreeting, setProactiveGreeting] = useState<string | null>(null)
  const { messages, streaming, sendMessage, clearMessages, setInitialMessages } = useChatStream()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const greetingFetched = useRef(false)

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
    // If this is the first message and we have a proactive greeting,
    // seed the greeting as prior assistant context so Claude continues naturally
    if (messages.length === 0 && proactiveGreeting) {
      setInitialMessages([
        { id: 'greeting-0', role: 'ASSISTANT', content: proactiveGreeting },
      ])
      // Prepend greeting context so the server-side Claude knows what was said
      const contextMessage = `[You greeted me with: "${proactiveGreeting}"]\n\nMy response: ${trimmed}`
      setTimeout(() => sendMessage(contextMessage), 50)
    } else {
      sendMessage(trimmed)
    }
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
          className="fixed inset-0 bg-black/40 z-30"
          onClick={handleDismiss}
        />
      )}

      <div className={`relative ${active ? 'z-40' : ''}`}>
        {/* Search Bar */}
        <div className={`bg-surface rounded-2xl border border-border transition-all ${active ? 'rounded-b-none border-b-0' : ''}`}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-5 pb-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">Gift Concierge</h3>
              <p className="text-xs text-muted mt-0.5">AI-powered assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
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
              className="flex-1 text-sm text-white placeholder-muted outline-none bg-transparent"
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
                    className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-hover transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Proactive greeting from concierge */}
          {!hasMessages && proactiveGreeting && (
            <div className="mx-4 mb-3 px-3 py-3 bg-primary/5 border border-primary/10 rounded-xl">
              <p className="text-xs text-secondary leading-relaxed">{proactiveGreeting}</p>
            </div>
          )}

          {/* Suggestions (when not active with messages) */}
          {!hasMessages && (
            <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
              {quickSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="px-3 py-1 text-xs text-primary border border-primary/20 rounded-full hover:bg-primary/10 transition whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expanded conversation area */}
        {active && hasMessages && (
          <div className="absolute left-0 right-0 bg-surface border border-t-0 border-border rounded-b-2xl overflow-hidden z-40">
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-hover">
              <span className="text-xs text-muted">
                {streaming ? 'Thinking...' : `${messages.length} messages`}
              </span>
              <Link
                href="/chat"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition"
              >
                Continue with Concierge
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
