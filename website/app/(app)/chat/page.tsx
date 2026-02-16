'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { SuggestionChip } from '@/components/chat/suggestion-chip'
import { useChatStream } from '@/lib/hooks/use-chat-stream'
import { MessageCircle } from 'lucide-react'

const defaultSuggestions = [
  'What should I get next?',
  'Show my unfunded items',
  'Gift ideas for upcoming events',
  'What\'s trending right now?',
]

export default function ChatPage() {
  const { messages, streaming, sendMessage, setInitialMessages } = useChatStream()
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const pendingQuerySent = useRef(false)

  const scrollToBottom = useCallback(() => {
    // Desktop: scroll container
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    // Mobile: scroll the sentinel into view
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load history on mount, then auto-send ?q= param if present
  useEffect(() => {
    fetch('/api/chat/history')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setInitialMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setInitialMessages])

  // Auto-send the ?q= query param after history loads
  useEffect(() => {
    if (loading || pendingQuerySent.current) return
    const q = searchParams.get('q')
    if (q) {
      pendingQuerySent.current = true
      sendMessage(q)
    }
  }, [loading, searchParams, sendMessage])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  if (loading) {
    return (
      <div className="lg:h-screen">
        <div className="p-4 lg:p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-gray-900">Gift Concierge</h1>
        </div>
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      </div>
    )
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center text-center">
      <MessageCircle className="h-16 w-16 text-[#333] mb-4" />
      <h2 className="text-lg font-medium text-gray-900 mb-2">Your Gift Concierge</h2>
      <p className="text-sm text-muted max-w-sm mb-6">
        I know your taste. Ask me for recommendations, help deciding, or what&apos;s trending in your world.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {defaultSuggestions.map((s) => (
          <SuggestionChip key={s} label={s} onClick={sendMessage} />
        ))}
      </div>
    </div>
  )

  const suggestionBar = messages.length > 0 && !streaming && (
    <div className="px-4 py-1.5 flex gap-2 overflow-x-auto flex-shrink-0">
      {defaultSuggestions.slice(0, 3).map((s) => (
        <SuggestionChip key={s} label={s} onClick={sendMessage} />
      ))}
    </div>
  )

  return (
    <>
      {/* Desktop: flex column layout */}
      <div className="hidden lg:flex flex-col h-screen">
        <div className="p-6 border-b border-border flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Gift Concierge</h1>
          <p className="text-sm text-muted">Your personal shopping assistant — ask about gifts, trends, and your wishlist</p>
        </div>
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">{emptyState}</div>
          ) : (
            messages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
            ))
          )}
        </div>
        {suggestionBar}
        <div className="flex-shrink-0">
          <ChatInput onSend={sendMessage} disabled={streaming} />
        </div>
      </div>

      {/* Mobile: flex column, NO fixed positioning — avoids Safari keyboard issues */}
      <div className="lg:hidden flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Gift Concierge</h1>
          <p className="text-sm text-muted">Your personal shopping assistant</p>
        </div>

        {/* Messages — flex-1 scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="pt-12">{emptyState}</div>
          ) : (
            messages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions + Input — pinned to bottom of flex, no position:fixed */}
        {suggestionBar}
        <div className="flex-shrink-0">
          <ChatInput onSend={sendMessage} disabled={streaming} onFocus={scrollToBottom} />
        </div>
      </div>
    </>
  )
}
