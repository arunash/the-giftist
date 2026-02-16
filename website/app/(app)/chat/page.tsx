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
  const searchParams = useSearchParams()
  const pendingQuerySent = useRef(false)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
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
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-16 w-16 text-[#333] mb-4" />
              <h2 className="text-lg font-medium text-gray-900 mb-2">Your Gift Concierge</h2>
              <p className="text-sm text-muted max-w-sm mb-6">
                I know your taste. Ask me for recommendations, help deciding, or what's trending in your world.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {defaultSuggestions.map((s) => (
                  <SuggestionChip key={s} label={s} onClick={sendMessage} />
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
            ))
          )}
        </div>
        {messages.length > 0 && !streaming && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
            {defaultSuggestions.slice(0, 3).map((s) => (
              <SuggestionChip key={s} label={s} onClick={sendMessage} />
            ))}
          </div>
        )}
        <div className="flex-shrink-0">
          <ChatInput onSend={sendMessage} disabled={streaming} />
        </div>
      </div>

      {/* Mobile: scrollable messages with fixed input above bottom nav */}
      <div className="lg:hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-2xl font-bold text-gray-900">Gift Concierge</h1>
          <p className="text-sm text-muted">Your personal shopping assistant</p>
        </div>

        {/* Messages — pad bottom for fixed input + bottom nav */}
        <div className="p-4 space-y-4 pb-36">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center pt-12">
              <MessageCircle className="h-16 w-16 text-[#333] mb-4" />
              <h2 className="text-lg font-medium text-gray-900 mb-2">Your Gift Concierge</h2>
              <p className="text-sm text-muted max-w-sm mb-6">
                I know your taste. Ask me for recommendations, help deciding, or what's trending in your world.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {defaultSuggestions.map((s) => (
                  <SuggestionChip key={s} label={s} onClick={sendMessage} />
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
            ))
          )}
        </div>

        {/* Fixed input bar — above the h-16 bottom nav */}
        <div className="fixed left-0 right-0 bottom-16 z-40 bg-surface overflow-hidden">
          {messages.length > 0 && !streaming && (
            <div className="px-4 py-1.5 flex gap-2 overflow-x-auto">
              {defaultSuggestions.slice(0, 3).map((s) => (
                <SuggestionChip key={s} label={s} onClick={sendMessage} />
              ))}
            </div>
          )}
          <ChatInput onSend={sendMessage} disabled={streaming} />
        </div>
      </div>
    </>
  )
}
