'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

const suggestions = [
  'Gift for mom under $50',
  'Birthday ideas for my partner',
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
    // Initial delay before showing first message
    const startDelay = setTimeout(() => {
      setVisible(true)
    }, 2000)

    return () => clearTimeout(startDelay)
  }, [])

  useEffect(() => {
    if (!visible) return

    const interval = setInterval(() => {
      setVisible(false)
      // Wait for fade-out, then switch message and fade in
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
          visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
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

export function HeroChatInput() {
  const [value, setValue] = useState('')
  const router = useRouter()

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    router.push(`/login?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input card */}
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

      {/* Suggestion chips */}
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

      {/* Live social proof ticker */}
      <LiveSearchTicker />
    </div>
  )
}
