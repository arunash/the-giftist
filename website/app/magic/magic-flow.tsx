'use client'

// /magic — single-question conversational gift reveal.
//
// 4 steps:
//   1. Their name + relationship
//   2. What they love (multi-select up to 3)
//   3. Budget
//   4. Loading sparkle animation → 3 hand-picked gifts with personalized why
//
// Visual: full-screen, single question per page, generous whitespace, big serif
// headlines. Distinct aesthetic from /shop's catalog density.

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, ArrowRight, MessageCircle, ExternalLink, Loader2 } from 'lucide-react'
import { trackClick, buildRetailerHref } from '@/lib/track-click'

type Step = 'who' | 'love' | 'budget' | 'loading' | 'reveal'

const RELATIONSHIPS = [
  { v: 'mom',      label: 'Mom',         emoji: '🌸' },
  { v: 'dad',      label: 'Dad',         emoji: '🪴' },
  { v: 'partner',  label: 'Partner',     emoji: '💞' },
  { v: 'friend',   label: 'Friend',      emoji: '🤝' },
  { v: 'sibling',  label: 'Sibling',     emoji: '🎈' },
  { v: 'self',     label: 'Myself',      emoji: '✨' },
]

const INTERESTS = [
  { v: 'reading',  label: 'Reading',  emoji: '📚' },
  { v: 'home',     label: 'Home',     emoji: '🏠' },
  { v: 'cooking',  label: 'Cooking',  emoji: '🍳' },
  { v: 'beauty',   label: 'Beauty',   emoji: '✨' },
  { v: 'fashion',  label: 'Fashion',  emoji: '👗' },
  { v: 'tech',     label: 'Tech',     emoji: '💻' },
  { v: 'wellness', label: 'Wellness', emoji: '🧘' },
  { v: 'fitness',  label: 'Fitness',  emoji: '💪' },
  { v: 'travel',   label: 'Travel',   emoji: '✈️' },
  { v: 'art',      label: 'Art',      emoji: '🎨' },
  { v: 'music',    label: 'Music',    emoji: '🎵' },
  { v: 'outdoor',  label: 'Outdoors', emoji: '🏕️' },
]

const BUDGETS = [
  { v: 'budget',  label: 'Under $30',  hint: 'Thoughtful' },
  { v: 'mid',     label: '$30 — $75',  hint: 'Sweet spot' },
  { v: 'premium', label: '$75 — $150', hint: 'Special' },
  { v: 'luxury',  label: '$150+',      hint: 'Big moment' },
]

const WHATSAPP_URL = 'https://wa.me/15014438478'

interface Pick {
  slug?: string
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  domain: string | null
  why: string
}

export function MagicFlow() {
  const [step, setStep] = useState<Step>('who')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState<string | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [budget, setBudget] = useState<string | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [error, setError] = useState<string | null>(null)

  const them = name.trim() || (relationship ? RELATIONSHIPS.find(r => r.v === relationship)?.label : null) || 'them'

  const submit = async (b: string) => {
    setStep('loading')
    setError(null)
    try {
      const res = await fetch('/api/magic/picks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          relationship: relationship || undefined,
          interests,
          priceTier: b,
        }),
      })
      if (!res.ok) throw new Error('Could not generate picks')
      const data = await res.json()
      // Fake-but-feel-good loading delay so the reveal lands as a moment
      await new Promise(r => setTimeout(r, 1400))
      setPicks(data.picks || [])
      setStep('reveal')
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setStep('budget')
    }
  }

  const toggleInterest = (i: string) => {
    setInterests(curr => {
      if (curr.includes(i)) return curr.filter(x => x !== i)
      if (curr.length >= 3) return curr // cap at 3
      return [...curr, i]
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-violet-50">
      {/* Minimal nav — one home link, no clutter */}
      <nav className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition">Giftist</span>
          </Link>
          {step !== 'reveal' && (
            <Link href="/shop" className="text-xs text-gray-400 hover:text-gray-700 transition">
              Or browse all gifts →
            </Link>
          )}
        </div>
      </nav>

      <main className="min-h-screen flex items-center justify-center px-6 py-20">
        {step === 'who' && (
          <StepWho
            name={name}
            setName={setName}
            relationship={relationship}
            setRelationship={setRelationship}
            onNext={() => setStep('love')}
          />
        )}
        {step === 'love' && (
          <StepLove
            them={them}
            interests={interests}
            toggleInterest={toggleInterest}
            onNext={() => setStep('budget')}
            onBack={() => setStep('who')}
          />
        )}
        {step === 'budget' && (
          <StepBudget
            them={them}
            budget={budget}
            setBudget={setBudget}
            onSubmit={submit}
            onBack={() => setStep('love')}
            error={error}
          />
        )}
        {step === 'loading' && <StepLoading them={them} />}
        {step === 'reveal' && (
          <StepReveal
            them={them}
            picks={picks}
            onRestart={() => {
              setStep('who'); setName(''); setRelationship(null); setInterests([]); setBudget(null); setPicks([])
            }}
          />
        )}
      </main>
    </div>
  )
}

// ── Step 1: Who's it for? ──
function StepWho({
  name, setName, relationship, setRelationship, onNext,
}: {
  name: string; setName: (v: string) => void
  relationship: string | null; setRelationship: (v: string) => void
  onNext: () => void
}) {
  const canContinue = !!relationship
  return (
    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-1.5 mb-4 justify-center">
        <Sparkles className="h-3.5 w-3.5 text-pink-500" />
        <p className="text-[10px] uppercase tracking-[0.2em] text-pink-500 font-bold">A gift, made magical</p>
      </div>
      <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 text-center leading-[1.1] tracking-tight mb-3">
        Who&apos;s it for?
      </h1>
      <p className="text-center text-gray-500 text-base mb-10 max-w-md mx-auto leading-relaxed">
        Tell us who you&apos;re shopping for. We&apos;ll pick three perfect things.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Their name (optional)"
        className="w-full text-center text-2xl font-serif px-6 py-4 mb-6 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl focus:border-pink-300 focus:ring-4 focus:ring-pink-100 outline-none transition"
        autoFocus
      />

      <div className="grid grid-cols-3 gap-2.5 mb-10">
        {RELATIONSHIPS.map(r => (
          <button
            key={r.v}
            onClick={() => setRelationship(r.v)}
            className={`p-4 rounded-2xl border-2 transition-all ${
              relationship === r.v
                ? 'border-pink-400 bg-pink-50 shadow-md scale-[1.03]'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">{r.emoji}</div>
            <div className="text-sm font-semibold text-gray-800">{r.label}</div>
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full inline-flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-semibold text-base hover:bg-gray-800 transition disabled:bg-gray-200 disabled:text-gray-400 disabled:pointer-events-none shadow-lg shadow-gray-900/10"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Step 2: What do they love? ──
function StepLove({
  them, interests, toggleInterest, onNext, onBack,
}: {
  them: string; interests: string[]
  toggleInterest: (i: string) => void
  onNext: () => void; onBack: () => void
}) {
  return (
    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 text-center leading-[1.1] tracking-tight mb-3">
        What does <span className="italic text-pink-500">{them}</span> love?
      </h1>
      <p className="text-center text-gray-500 text-base mb-10 max-w-md mx-auto leading-relaxed">
        Pick up to 3. Don&apos;t overthink it — closest match is fine.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-10">
        {INTERESTS.map(i => {
          const selected = interests.includes(i.v)
          return (
            <button
              key={i.v}
              onClick={() => toggleInterest(i.v)}
              className={`p-4 rounded-2xl border-2 transition-all ${
                selected
                  ? 'border-pink-400 bg-pink-50 shadow-md scale-[1.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{i.emoji}</div>
              <div className="text-xs sm:text-sm font-semibold text-gray-800">{i.label}</div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="px-5 py-4 rounded-2xl text-gray-500 hover:text-gray-900 transition text-sm"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 inline-flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-semibold text-base hover:bg-gray-800 transition shadow-lg shadow-gray-900/10"
        >
          {interests.length > 0 ? `Continue with ${interests.length}` : 'Skip — surprise me'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Budget ──
function StepBudget({
  them, budget, setBudget, onSubmit, onBack, error,
}: {
  them: string; budget: string | null; setBudget: (v: string) => void
  onSubmit: (b: string) => void; onBack: () => void; error: string | null
}) {
  return (
    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 text-center leading-[1.1] tracking-tight mb-3">
        Your budget for <span className="italic text-pink-500">{them}</span>?
      </h1>
      <p className="text-center text-gray-500 text-base mb-10 max-w-md mx-auto leading-relaxed">
        We&apos;ll find three picks within range, at different price points.
      </p>

      <div className="space-y-3 mb-6">
        {BUDGETS.map(b => (
          <button
            key={b.v}
            onClick={() => { setBudget(b.v); onSubmit(b.v) }}
            className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
              budget === b.v
                ? 'border-pink-400 bg-pink-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div>
              <div className="text-lg font-bold text-gray-900">{b.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{b.hint}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
          </button>
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-500 mb-3">{error}</p>}

      <button
        onClick={onBack}
        className="w-full text-center text-sm text-gray-400 hover:text-gray-700 transition py-2"
      >
        ← Back
      </button>
    </div>
  )
}

// ── Loading reveal ──
function StepLoading({ them }: { them: string }) {
  return (
    <div className="w-full max-w-md text-center animate-in fade-in zoom-in duration-500">
      <div className="relative inline-block mb-8">
        <div className="absolute inset-0 bg-pink-300/40 blur-3xl animate-pulse" />
        <Sparkles className="relative h-16 w-16 text-pink-500 animate-pulse" />
      </div>
      <h2 className="font-serif text-3xl text-gray-900 leading-tight mb-3">
        Finding three perfect things for <span className="italic text-pink-500">{them}</span>…
      </h2>
      <p className="text-sm text-gray-500">Vetting expert picks · matching tastes · checking prices</p>
    </div>
  )
}

// ── Reveal ──
function StepReveal({
  them, picks, onRestart,
}: {
  them: string; picks: Pick[]; onRestart: () => void
}) {
  const handleBuy = (p: Pick) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button > 0) return
    if (!p.slug) return
    e.preventDefault()
    window.open(buildRetailerHref(p.slug), '_blank', 'noopener,noreferrer')
  }

  if (picks.length === 0) {
    return (
      <div className="text-center max-w-md animate-in fade-in duration-500">
        <h2 className="font-serif text-3xl text-gray-900 mb-3">Hmm — nothing felt right.</h2>
        <p className="text-gray-500 text-sm mb-6">
          Let&apos;s try a fresh take. Or chat with our concierge directly.
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={onRestart} className="py-3 px-6 bg-gray-900 text-white rounded-2xl font-semibold text-sm">
            Try again
          </button>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent('I tried the magic picker but nothing matched')}`}
            target="_blank" rel="noopener noreferrer"
            className="py-3 px-6 bg-[#25D366] text-white rounded-2xl font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Talk to a human
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10 sm:mb-14">
        <div className="inline-flex items-center gap-1.5 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-pink-500" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-pink-500 font-bold">Three perfect things</p>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-[1.1] tracking-tight">
          For <span className="italic text-pink-500">{them}</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {picks.map((p, i) => (
          <div
            key={p.slug || i}
            className="group bg-white rounded-3xl shadow-lg shadow-gray-900/5 overflow-hidden hover:shadow-xl hover:shadow-gray-900/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'backwards' }}
          >
            {p.image && (
              <a
                href={p.slug ? `/p/${p.slug}` : '#'}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return
                  if (!p.slug) return
                  e.preventDefault()
                  trackClick(p.slug, 'CARD_CLICK', 'WEB')
                  window.open(`/p/${p.slug}`, '_blank', 'noopener,noreferrer')
                }}
                className="block relative aspect-square bg-gray-50 overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {p.price && (
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-sm font-bold text-gray-900 px-2.5 py-1 rounded-full shadow-md">
                    {p.price}
                  </div>
                )}
              </a>
            )}
            <div className="p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                {p.domain?.replace('www.', '')}
              </p>
              <h3 className="font-serif text-xl text-gray-900 leading-tight mb-3">
                {p.name}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-5 italic">
                &ldquo;{p.why}&rdquo;
              </p>
              <a
                href={p.slug ? `/go-r/${p.slug}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleBuy(p)}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition group/btn"
              >
                <ExternalLink className="h-4 w-4" />
                Buy on {p.domain?.replace('www.', '')}
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
        <a
          href={`${WHATSAPP_URL}?text=${encodeURIComponent(`I'm shopping for ${them} — can you help me decide?`)}`}
          target="_blank" rel="noopener noreferrer"
          onClick={() => trackClick('magic-reveal-wa', 'WA_INTENT', 'WEB')}
          className="inline-flex items-center gap-2 py-3 px-6 bg-[#25D366] text-white rounded-full font-semibold text-sm hover:bg-[#20bd5a] transition shadow-md"
        >
          <MessageCircle className="h-4 w-4" />
          Chat with our concierge
        </a>
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 py-3 px-6 bg-white border border-gray-200 text-gray-700 rounded-full font-semibold text-sm hover:bg-gray-50 transition"
        >
          Pick for someone else
        </button>
      </div>
    </div>
  )
}
