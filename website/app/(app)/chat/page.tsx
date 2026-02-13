'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { SuggestionChip } from '@/components/chat/suggestion-chip'
import { useChatStream } from '@/lib/hooks/use-chat-stream'
import { MessageCircle } from 'lucide-react'

const defaultSuggestions = [
  'What should I buy next?',
  'Show my unfunded items',
  'Gift ideas for upcoming events',
  'What are my most expensive items?',
]

export default function ChatPage() {
  const { messages, streaming, sendMessage, setInitialMessages } = useChatStream()
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // Load history on mount
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

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-secondary">Chat</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-2xl font-bold text-secondary">Chat</h1>
        <p className="text-sm text-gray-500">Ask about your wishlist, get gift ideas, and more</p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-16 w-16 text-gray-200 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h2>
            <p className="text-sm text-gray-500 max-w-sm mb-6">
              Ask me about your wishlist, get gift recommendations, or help deciding what to buy.
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

      {/* Suggestion chips (when there are messages) */}
      {messages.length > 0 && !streaming && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
          {defaultSuggestions.slice(0, 3).map((s) => (
            <SuggestionChip key={s} label={s} onClick={sendMessage} />
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0">
        <ChatInput onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  )
}
