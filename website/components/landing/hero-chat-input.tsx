'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles, Lock } from 'lucide-react'
import Link from 'next/link'

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

// Teaser responses keyed by rough category
const teaserResponses: Record<string, string[]> = {
  mom: [
    'I found 3 amazing options for her! A personalized recipe book, a luxe candle set, and a...',
    'Based on popular picks, here are some curated ideas: a custom photo calendar, a spa gift basket, and...',
  ],
  partner: [
    'Great taste! I have some ideas: a couples experience box, a custom star map of your first date, and...',
    'Here are my top picks: a personalized love letter book, a sunset cruise voucher, and...',
  ],
  birthday: [
    'Birthday shopping is my specialty! Here are 3 ideas: a custom illustration portrait, a curated snack box, and...',
    'I pulled together some crowd favorites: a memory book, a surprise experience, and...',
  ],
  default: [
    'I have some perfect suggestions! A curated gift box, a personalized keepsake, and...',
    'Great question! Here are my top 3 picks: a thoughtful experience gift, a custom item, and...',
  ],
}

function getTeaserResponse(query: string): string {
  const lower = query.toLowerCase()
  if (lower.includes('mom') || lower.includes('mother')) {
    return teaserResponses.mom[Math.floor(Math.random() * teaserResponses.mom.length)]
  }
  if (lower.includes('partner') || lower.includes('wife') || lower.includes('husband') || lower.includes('boyfriend') || lower.includes('girlfriend') || lower.includes('anniversary')) {
    return teaserResponses.partner[Math.floor(Math.random() * teaserResponses.partner.length)]
  }
  if (lower.includes('birthday')) {
    return teaserResponses.birthday[Math.floor(Math.random() * teaserResponses.birthday.length)]
  }
  return teaserResponses.default[Math.floor(Math.random() * teaserResponses.default.length)]
}

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

type Stage = 'input' | 'thinking' | 'teaser'

export function HeroChatInput() {
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<Stage>('input')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [teaserText, setTeaserText] = useState('')
  const [displayedTeaser, setDisplayedTeaser] = useState('')
  const router = useRouter()
  const chatRef = useRef<HTMLDivElement>(null)

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setSubmittedQuery(trimmed)
    setValue('')
    setStage('thinking')

    // After a brief "thinking" delay, show teaser
    setTimeout(() => {
      const response = getTeaserResponse(trimmed)
      setTeaserText(response)
      setDisplayedTeaser('')
      setStage('teaser')
    }, 1800)
  }

  // Typewriter effect for teaser response
  useEffect(() => {
    if (stage !== 'teaser' || !teaserText) return
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayedTeaser(teaserText.slice(0, i))
      if (i >= teaserText.length) clearInterval(interval)
    }, 20)
    return () => clearInterval(interval)
  }, [stage, teaserText])

  // Scroll chat into view when stage changes
  useEffect(() => {
    if (stage !== 'input') {
      chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [stage])

  const reset = () => {
    setStage('input')
    setSubmittedQuery('')
    setTeaserText('')
    setDisplayedTeaser('')
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

  // Chat conversation view (thinking + teaser stages)
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

          {/* AI thinking or teaser */}
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-700">
              {stage === 'thinking' ? (
                <TypingIndicator />
              ) : (
                <p className="px-4 py-2.5 text-[14px] leading-relaxed">
                  {displayedTeaser}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Signup gate */}
        {stage === 'teaser' && displayedTeaser.length >= teaserText.length && (
          <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-primary/5 to-orange-50 border border-primary/15 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Sign up free to see full recommendations
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Get personalized gift ideas with prices, links, and one-tap saving to your wishlist.
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
