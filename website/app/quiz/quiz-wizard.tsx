'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

// 4-question gift quiz. Submit redirects to /shop with filters pre-applied
// + ?from=quiz so the shop page can show a "Your matches" header.
//
// Skipping "vibe" intentionally — it doesn't map cleanly to any TastemakerGift
// field. Better to ship 4 questions that route deterministically than 5 that
// guess.

type StepKey = 'recipient' | 'occasion' | 'price' | 'category'

const STEPS: { key: StepKey; title: string; subtitle: string; options: { value: string; label: string; emoji?: string }[] }[] = [
  {
    key: 'recipient',
    title: "Who's the gift for?",
    subtitle: "We'll narrow the catalog to gifts that fit them.",
    options: [
      { value: 'mom',      label: 'Mom',         emoji: '🌸' },
      { value: 'dad',      label: 'Dad',         emoji: '👔' },
      { value: 'partner',  label: 'Partner',     emoji: '💞' },
      { value: 'friend',   label: 'Friend',      emoji: '🤝' },
      { value: 'coworker', label: 'Coworker',    emoji: '💼' },
      { value: 'self',     label: 'Myself',      emoji: '✨' },
    ],
  },
  {
    key: 'occasion',
    title: "What's the occasion?",
    subtitle: "Helps us match the right vibe.",
    options: [
      { value: 'mothers-day', label: "Mother's Day",   emoji: '🌸' },
      { value: 'birthday',    label: 'Birthday',        emoji: '🎂' },
      { value: 'anniversary', label: 'Anniversary',     emoji: '💍' },
      { value: 'wedding',     label: 'Wedding',         emoji: '💐' },
      { value: 'christmas',   label: 'Christmas',       emoji: '🎄' },
      { value: 'just-because', label: 'Just Because',  emoji: '💝' },
    ],
  },
  {
    key: 'price',
    title: "What's your budget?",
    subtitle: "Pick a range — you can still see lower-priced options too.",
    options: [
      { value: 'budget',  label: 'Under $30',   emoji: '💵' },
      { value: 'mid',     label: '$30 — $75',   emoji: '💵💵' },
      { value: 'premium', label: '$75 — $150',  emoji: '💵💵💵' },
      { value: 'luxury',  label: '$150+',       emoji: '💎' },
    ],
  },
  {
    key: 'category',
    title: "What are they into?",
    subtitle: "Pick the closest match — you'll still see crossover picks.",
    options: [
      { value: 'all',      label: 'Surprise me',  emoji: '🎁' },
      { value: 'books',    label: 'Reading',      emoji: '📚' },
      { value: 'home',     label: 'Home',         emoji: '🏠' },
      { value: 'cooking',  label: 'Cooking',      emoji: '🍳' },
      { value: 'beauty',   label: 'Beauty',       emoji: '✨' },
      { value: 'fashion',  label: 'Fashion',      emoji: '👗' },
      { value: 'tech',     label: 'Tech',         emoji: '💻' },
      { value: 'fitness',  label: 'Fitness',      emoji: '💪' },
      { value: 'travel',   label: 'Travel',       emoji: '✈️' },
      { value: 'art',      label: 'Art',          emoji: '🎨' },
      { value: 'wellness', label: 'Wellness',     emoji: '🧘' },
      { value: 'music',    label: 'Music',        emoji: '🎵' },
    ],
  },
]

export function QuizWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0
  const progress = ((step + 1) / STEPS.length) * 100

  const choose = (value: string) => {
    const updated = { ...answers, [current.key]: value }
    setAnswers(updated)
    if (isLast) {
      finish(updated)
    } else {
      // Tiny delay to let the user see the selection animate
      setTimeout(() => setStep(s => s + 1), 150)
    }
  }

  const finish = (a: Partial<Record<StepKey, string>>) => {
    setSubmitting(true)
    const params = new URLSearchParams()
    if (a.recipient && a.recipient !== 'all') params.set('recipient', a.recipient)
    if (a.occasion) params.set('occasion', a.occasion)
    if (a.price && a.price !== 'all') params.set('price', a.price)
    if (a.category && a.category !== 'all') params.set('category', a.category)
    params.set('from', 'quiz')
    router.push(`/shop?${params.toString()}#all-gifts`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-1.5 mb-3">
          <Sparkles className="h-4 w-4 text-pink-500" />
          <p className="text-[10px] uppercase tracking-wider text-pink-500 font-bold">30-Second Gift Finder</p>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {current.title}
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
          {current.subtitle}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8 sm:mb-10">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {current.options.map((opt) => {
          const selected = answers[current.key] === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => choose(opt.value)}
              disabled={submitting}
              className={`group relative p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                selected
                  ? 'border-pink-500 bg-pink-50 shadow-md scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              } disabled:opacity-50 disabled:pointer-events-none`}
            >
              {opt.emoji && (
                <div className="text-2xl sm:text-3xl mb-2">{opt.emoji}</div>
              )}
              <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
              {selected && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-8 sm:mt-10">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={isFirst || submitting}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        {!isLast && (
          <button
            onClick={() => answers[current.key] && setStep(s => s + 1)}
            disabled={!answers[current.key] || submitting}
            className="inline-flex items-center gap-1 text-sm font-semibold text-pink-500 hover:text-pink-600 transition disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {isLast && submitting && (
          <span className="text-sm font-semibold text-pink-500 inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
            Finding your picks…
          </span>
        )}
      </div>

      {/* Skip */}
      <p className="text-center text-[11px] text-gray-400 mt-10">
        Prefer to chat?{' '}
        <a
          href="https://wa.me/15014438478?text=I%20need%20help%20finding%20a%20gift"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-500 font-semibold hover:underline"
        >
          Talk to our concierge on WhatsApp →
        </a>
      </p>
    </div>
  )
}
