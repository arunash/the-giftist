'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, Sparkles, Lock, Gift, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { ProductData } from '@/lib/parse-chat-content'

const suggestions = [
  'Gift for mom under $50',
  'Birthday ideas for my partner',
  'Housewarming gift for a coworker',
  'Anniversary surprise for my wife',
]

const tickerMessages = [
  { name: 'Sarah', city: 'NYC', query: 'birthday gifts for her mom' },
  { name: 'Alex', city: 'LA', query: 'headphones under $100' },
  { name: 'Priya', city: 'Chicago', query: 'anniversary ideas' },
  { name: 'Marcus', city: 'Austin', query: 'housewarming gift for his coworker' },
  { name: 'Jenna', city: 'Seattle', query: 'gifts for a plant lover' },
  { name: 'David', city: 'Miami', query: 'Valentine\'s Day surprise' },
  { name: 'Aisha', city: 'Denver', query: 'graduation gifts under $75' },
  { name: 'Ryan', city: 'Portland', query: 'something unique for his dad' },
  { name: 'Mei', city: 'SF', query: 'baby shower gift ideas' },
  { name: 'Carlos', city: 'Dallas', query: 'best tech gifts for teens' },
  { name: 'Emma', city: 'Boston', query: 'thank-you gift for her teacher' },
  { name: 'Jordan', city: 'Nashville', query: 'wedding registry alternatives' },
  { name: 'Olivia', city: 'Atlanta', query: 'gifts for someone who has everything' },
  { name: 'Liam', city: 'Phoenix', query: 'Secret Santa ideas under $25' },
  { name: 'Nina', city: 'DC', query: 'experience gifts for couples' },
]

const pastelColors = [
  'bg-rose-100 text-rose-600',
  'bg-sky-100 text-sky-600',
  'bg-violet-100 text-violet-600',
  'bg-amber-100 text-amber-600',
  'bg-emerald-100 text-emerald-600',
  'bg-pink-100 text-pink-600',
  'bg-indigo-100 text-indigo-600',
  'bg-teal-100 text-teal-600',
]

function getColorForName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return pastelColors[Math.abs(hash) % pastelColors.length]
}

function LiveSearchTicker() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const startDelay = setTimeout(() => {
      setVisible(true)
    }, 2000)
    return () => clearTimeout(startDelay)
  }, [])

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % tickerMessages.length)
        setVisible(true)
      }, 400)
    }, 4000)
    return () => clearInterval(interval)
  }, [visible])

  const msg = tickerMessages[index]
  const colorClass = getColorForName(msg.name)
  const initials = msg.name[0]

  return (
    <div className="min-h-[2rem] mt-4 flex justify-center">
      <div
        key={index}
        className={`inline-flex items-baseline gap-2 transition-all duration-400 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div
          className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold translate-y-[1px] ${colorClass}`}
        >
          {initials}
        </div>
        <p className="text-sm text-gray-400 text-center">
          <span className="text-gray-500">{msg.name} from {msg.city}</span>
          {' is looking for '}
          <span className="text-gray-500 font-medium">&ldquo;{msg.query}&rdquo;</span>
        </p>
      </div>
    </div>
  )
}

// Typing dots animation
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// Lightweight product card for landing page (no "Add to List", just "Buy Now" affiliate link)
function LandingProductCard({ product }: { product: ProductData }) {
  const [previewImage, setPreviewImage] = useState<string | null>(product.image || null)
  const [loadingImage, setLoadingImage] = useState(false)
  const didFetch = useRef(false)

  useEffect(() => {
    if (previewImage || didFetch.current || (!product.url && !product.name)) return
    didFetch.current = true
    setLoadingImage(true)
    const params = new URLSearchParams()
    if (product.url) params.set('url', product.url)
    if (product.name) params.set('name', product.name)
    fetch(`/api/products/preview?${params.toString()}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.image) setPreviewImage(data.image)
      })
      .catch(() => {})
      .finally(() => setLoadingImage(false))
  }, [previewImage, product.url, product.name])

  // URLs come pre-validated and affiliate-tagged from the server
  const viewUrl = product.url || null

  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 my-2">
      {viewUrl ? (
        <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 block">
          {previewImage ? (
            <img src={previewImage} alt={product.name} className="w-full h-full object-cover" />
          ) : loadingImage ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-4 w-4 text-gray-300 animate-spin" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Gift className="h-5 w-5 text-gray-400" />
            </div>
          )}
        </a>
      ) : (
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
          {previewImage ? (
            <img src={previewImage} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Gift className="h-5 w-5 text-gray-400" />
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="min-w-0">
          {viewUrl ? (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 line-clamp-1 hover:text-primary transition block">
              {product.name}
            </a>
          ) : (
            <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{product.name}</h4>
          )}
          {product.price && (
            <p className="text-xs font-semibold text-primary mt-0.5">{product.price}</p>
          )}
        </div>
        {viewUrl && (
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition"
          >
            <ExternalLink className="h-3 w-3" />
            Buy Now
          </a>
        )}
      </div>
    </div>
  )
}

type Stage = 'input' | 'thinking' | 'response'

export function HeroChatInput() {
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<Stage>('input')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [responseText, setResponseText] = useState('')
  const [products, setProducts] = useState<ProductData[]>([])
  const [error, setError] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const submit = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setSubmittedQuery(trimmed)
    setValue('')
    setStage('thinking')
    setError(false)

    try {
      const res = await fetch('/api/chat/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()

      // API returns pre-parsed text and products with resolved/validated URLs
      setResponseText(data.text || '')
      setProducts(data.products || [])
      setStage('response')
    } catch {
      setError(true)
      setStage('response')
    }
  }

  // Scroll chat into view when stage changes
  useEffect(() => {
    if (stage !== 'input') {
      chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [stage])

  const reset = () => {
    setStage('input')
    setSubmittedQuery('')
    setResponseText('')
    setProducts([])
    setError(false)
  }

  if (stage === 'input') {
    return (
      <div className="w-full max-w-2xl mx-auto">
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

        <LiveSearchTicker />
      </div>
    )
  }

  // Chat conversation view (thinking + response stages)
  return (
    <div ref={chatRef} className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
        {/* Chat header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Gift Concierge</p>
            <p className="text-[11px] text-green-500">Online</p>
          </div>
        </div>

        {/* Chat messages */}
        <div className="p-4 space-y-3">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed bg-primary text-white">
              {submittedQuery}
            </div>
          </div>

          {/* AI response */}
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-700">
              {stage === 'thinking' ? (
                <TypingIndicator />
              ) : error ? (
                <p className="px-4 py-2.5 text-[14px] leading-relaxed">
                  Something went wrong. Try again or{' '}
                  <Link href="/login" className="text-primary font-medium hover:underline">sign up</Link>{' '}
                  for the full experience.
                </p>
              ) : (
                <div className="px-4 py-2.5">
                  {responseText && (
                    <p className="text-[14px] leading-relaxed mb-2">{responseText}</p>
                  )}
                  {products.map((product, i) => (
                    <LandingProductCard key={i} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signup nudge — shown after response loads */}
        {stage === 'response' && !error && (
          <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-primary/5 to-orange-50 border border-primary/15 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Sign up free to save items & get personalized picks
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Create wishlists, track prices, and get recommendations tailored to your taste.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href={`/login?q=${encodeURIComponent(submittedQuery)}`}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary-hover transition"
                  >
                    Sign Up Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={reset}
                    className="text-sm text-gray-400 hover:text-gray-600 transition px-3 py-2"
                  >
                    Ask another question
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
