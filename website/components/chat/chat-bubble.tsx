'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { parseChatContent, type ProductData, type EventData } from '@/lib/parse-chat-content'
import { ProductCard } from './product-card'
import { Check, Calendar } from 'lucide-react'
import Link from 'next/link'

interface ChatBubbleProps {
  role: 'USER' | 'ASSISTANT'
  content: string
}

async function addProductToList(product: ProductData) {
  if (product.url) {
    const res = await fetch('/api/items/from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: product.url, source: 'CHAT' }),
    })
    if (!res.ok) throw new Error('Failed to add')
  } else {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        url: `https://www.google.com/search?q=${encodeURIComponent(product.name)}`,
        source: 'CHAT',
      }),
    })
    if (!res.ok) throw new Error('Failed to add')
  }
}

async function savePreferences(data: Record<string, any>) {
  await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

async function createEvent(data: EventData): Promise<{ id: string; name: string } | null> {
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        type: data.type,
        date: data.date,
        isPublic: true,
      }),
    })
    if (!res.ok) return null
    const event = await res.json()
    return { id: event.id, name: event.name }
  } catch {
    return null
  }
}

function EventConfirmation({ data }: { data: EventData }) {
  const [event, setEvent] = useState<{ id: string; name: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)

  useState(() => {
    if (created || creating) return
    setCreating(true)
    createEvent(data).then((result) => {
      setCreating(false)
      if (result) {
        setEvent(result)
        setCreated(true)
      }
    })
  })

  const dateStr = new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  if (creating) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl my-2 text-xs text-blue-400">
        <Calendar className="h-3.5 w-3.5 animate-pulse" />
        Creating event...
      </div>
    )
  }

  if (created && event) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl my-2 text-xs text-blue-400">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          Event created: {data.name} ({dateStr})
        </div>
        <Link href={`/events/${event.id}`} className="text-primary hover:text-primary-hover font-medium ml-2">
          Add items &rarr;
        </Link>
      </div>
    )
  }

  return null
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'USER'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap bg-primary text-white rounded-br-md">
          {content}
        </div>
      </div>
    )
  }

  // Parse assistant messages for product cards and preference blocks
  const segments = parseChatContent(content)

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%]">
        {segments.map((segment, i) => {
          if (segment.type === 'text') {
            return (
              <div
                key={i}
                className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap bg-surface-raised border border-border text-secondary rounded-bl-md"
              >
                {segment.content}
              </div>
            )
          }
          if (segment.type === 'product') {
            return (
              <ProductCard
                key={i}
                product={segment.data}
                onAdd={addProductToList}
              />
            )
          }
          if (segment.type === 'preferences') {
            // Auto-save preferences
            savePreferences(segment.data).catch(() => {})
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl my-2 text-xs text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Preferences updated!
              </div>
            )
          }
          if (segment.type === 'event') {
            return <EventConfirmation key={i} data={segment.data} />
          }
          return null
        })}
      </div>
    </div>
  )
}
