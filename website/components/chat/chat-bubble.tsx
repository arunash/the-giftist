'use client'

import { cn } from '@/lib/utils'
import { parseChatContent, type ProductData } from '@/lib/parse-chat-content'
import { ProductCard } from './product-card'
import { Check } from 'lucide-react'

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
          return null
        })}
      </div>
    </div>
  )
}
