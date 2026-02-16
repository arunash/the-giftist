'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { parseChatContent, type ProductData, type EventData, type AddToEventData } from '@/lib/parse-chat-content'
import { ProductCard } from './product-card'
import { Check, Calendar, Gift } from 'lucide-react'
import Link from 'next/link'

interface ChatBubbleProps {
  role: 'USER' | 'ASSISTANT'
  content: string
  autoExecute?: boolean
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

function parsePriceValue(price?: string): number | null {
  if (!price) return null
  const match = price.replace(/,/g, '').match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

async function addItemToEvent(data: AddToEventData): Promise<boolean> {
  try {
    let itemId = data.itemId

    // If no itemId or it's a placeholder, look for existing item or create new one
    if (!itemId || itemId === 'TBD' || itemId === 'new') {
      // Check if an item with the same name already exists for this user
      try {
        const searchRes = await fetch('/api/items')
        if (searchRes.ok) {
          const existing = await searchRes.json()
          const match = Array.isArray(existing)
            ? existing.find((item: any) => item.name?.toLowerCase() === data.itemName.toLowerCase())
            : null
          if (match) {
            itemId = match.id
          }
        }
      } catch {
        // Ignore search errors, fall through to create
      }

      if (!itemId || itemId === 'TBD' || itemId === 'new') {
        const priceValue = parsePriceValue(data.price)
        const createRes = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.itemName,
            price: data.price || null,
            priceValue,
            url: `https://www.google.com/search?q=${encodeURIComponent(data.itemName)}`,
            source: 'CHAT',
          }),
        })
        if (!createRes.ok) return false
        const newItem = await createRes.json()
        itemId = newItem.id

        // Fire-and-forget: enrich item with real image in background
        fetch(`/api/items/${itemId}/enrich`, { method: 'POST' }).catch(() => {})
      }
    }

    // Resolve eventId — if "new" or invalid, find by event name
    let resolvedEventId = data.eventId
    if (!resolvedEventId || resolvedEventId === 'new' || resolvedEventId === 'TBD') {
      if (data.eventName) {
        const eventsRes = await fetch('/api/events')
        if (eventsRes.ok) {
          const events = await eventsRes.json()
          const match = events.find((e: any) =>
            e.name.toLowerCase().includes(data.eventName!.toLowerCase())
          )
          if (match) resolvedEventId = match.id
        }
      }
      if (!resolvedEventId || resolvedEventId === 'new' || resolvedEventId === 'TBD') return false
    }

    // Link item to event
    const res = await fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: resolvedEventId }),
    })
    return res.ok
  } catch {
    return false
  }
}

function AddToEventConfirmation({ data, autoExecute }: { data: AddToEventData; autoExecute?: boolean }) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const didRun = useRef(false)

  useEffect(() => {
    if (!autoExecute || didRun.current || added || adding) return
    didRun.current = true
    setAdding(true)
    addItemToEvent(data).then((ok) => {
      setAdding(false)
      if (ok) setAdded(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (adding) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl my-2 text-xs text-purple-600">
        <Gift className="h-3.5 w-3.5 animate-pulse" />
        Adding to event...
      </div>
    )
  }

  // Show static confirmation for historical messages or after successful add
  if (added || !autoExecute) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl my-2 text-xs text-purple-600">
        <div className="flex items-center gap-2">
          <Gift className="h-3.5 w-3.5" />
          Added "{data.itemName}" to {data.eventName}
        </div>
        {data.eventId && data.eventId !== 'TBD' && data.eventId !== 'new' && (
          <Link href={`/events/${data.eventId}`} className="text-primary hover:text-primary-hover font-medium ml-2">
            View event &rarr;
          </Link>
        )}
      </div>
    )
  }

  return null
}

function EventConfirmation({ data, autoExecute }: { data: EventData; autoExecute?: boolean }) {
  const [event, setEvent] = useState<{ id: string; name: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const didRun = useRef(false)

  const dateStr = new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  useEffect(() => {
    if (!autoExecute || didRun.current || created || creating) return
    didRun.current = true
    setCreating(true)
    createEvent(data).then((result) => {
      setCreating(false)
      if (result) {
        setEvent(result)
        setCreated(true)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (creating) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl my-2 text-xs text-blue-600">
        <Calendar className="h-3.5 w-3.5 animate-pulse" />
        Creating event...
      </div>
    )
  }

  // Show static confirmation for historical messages or after successful creation
  if (created && event) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl my-2 text-xs text-blue-600">
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

  if (!autoExecute) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl my-2 text-xs text-blue-600">
        <Calendar className="h-3.5 w-3.5" />
        Event created: {data.name} ({dateStr})
      </div>
    )
  }

  return null
}

function PreferencesConfirmation({ data, autoExecute }: { data: Record<string, any>; autoExecute?: boolean }) {
  const didRun = useRef(false)

  useEffect(() => {
    if (!autoExecute || didRun.current) return
    didRun.current = true
    savePreferences(data).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl my-2 text-xs text-green-600">
      <Check className="h-3.5 w-3.5" />
      Preferences updated!
    </div>
  )
}

export function ChatBubble({ role, content, autoExecute = false }: ChatBubbleProps) {
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
                onAdd={autoExecute ? addProductToList : undefined}
              />
            )
          }
          if (segment.type === 'preferences') {
            return <PreferencesConfirmation key={i} data={segment.data} autoExecute={autoExecute} />
          }
          if (segment.type === 'event') {
            return <EventConfirmation key={i} data={segment.data} autoExecute={autoExecute} />
          }
          if (segment.type === 'add_to_event') {
            return <AddToEventConfirmation key={i} data={segment.data} autoExecute={autoExecute} />
          }
          return null
        })}
      </div>
    </div>
  )
}
