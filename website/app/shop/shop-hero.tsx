'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, Sparkles, Star, ArrowDown, Wand2 } from 'lucide-react'
import { trackClick } from '@/lib/track-click'

const WHATSAPP_URL = 'https://wa.me/15014438478'

// Mother's Day 2026 — 2nd Sunday of May
const MOTHERS_DAY = new Date(2026, 4, 10) // May 10, 2026

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

function trackWaIntent(slug: string) {
  trackClick(slug, 'WA_INTENT', 'WEB')
}

export function ShopHero() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  // Mounted gate so server-rendered HTML matches the default hero on first paint,
  // then we swap to the personalized variant after hydration. Avoids hydration mismatch
  // and lets the page-cache deliver the same HTML to everyone.
  useEffect(() => { setMounted(true) }, [])

  const isMothersDay = useMemo(() => {
    const occasion = searchParams.get('occasion')
    const campaign = searchParams.get('utm_campaign') || ''
    return occasion === 'mothers-day' || campaign.startsWith('md-') || campaign === 'mothers-day-shop-test'
  }, [searchParams])

  const md = useMemo(() => {
    const days = daysUntil(MOTHERS_DAY)
    return {
      days,
      daysLabel: days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`,
      // Latest order date to ship in time (3-day buffer)
      shipBy: new Date(MOTHERS_DAY.getTime() - 3 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  }, [])

  // ── Mother's Day variant — above-the-fold conversion engine ──
  if (mounted && isMothersDay) {
    const waPrefill = `Hi! I'm shopping for a Mother's Day gift. Can you help me find something she'll love?`
    return (
      <section className="bg-gradient-to-b from-pink-50 to-white border-b border-pink-100">
        <div className="max-w-6xl mx-auto px-4 pt-10 pb-8 sm:pt-14 sm:pb-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <Sparkles className="h-3 w-3" />
              Mother's Day · {md.daysLabel}
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
              Find Mom a gift she&apos;ll <span className="text-pink-600">actually</span> love
            </h1>
            <p className="text-gray-600 mt-4 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              700+ hand-picked gifts vetted by Wirecutter, The Strategist, and Oprah&apos;s editors. Order by <span className="font-semibold text-gray-900">{md.shipBy}</span> to ship in time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-7">
              <a
                href={`${WHATSAPP_URL}?text=${encodeURIComponent(waPrefill)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWaIntent('shop-hero-wa')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#25D366] text-white text-base font-semibold px-6 py-3.5 rounded-xl hover:bg-[#20bd5a] transition shadow-lg shadow-[#25D366]/30"
              >
                <MessageCircle className="h-5 w-5" />
                Tell our concierge (free, 30s)
              </a>
              <Link
                href="/quiz"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-900 text-base font-semibold px-6 py-3.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition"
              >
                <Wand2 className="h-4 w-4" />
                Take the 30s quiz
              </Link>
            </div>
            <div className="flex items-center justify-center gap-1 mt-4 text-xs text-gray-500">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="ml-1">Backed by 2,400+ gift recommendations</span>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ── Default hero ──
  return (
    <div className="max-w-6xl mx-auto px-4 pt-12 pb-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          Gifts people actually want
        </h1>
        <p className="text-gray-500 mt-3 text-base sm:text-lg leading-relaxed">
          Every pick is backed by expert reviews from Wirecutter, The Strategist, Reddit, and real purchase data. No filler, no generic candles.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center items-center mt-5">
          <Link
            href="/quiz"
            className="inline-flex items-center gap-1.5 bg-pink-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-pink-600 transition shadow-sm"
          >
            <Wand2 className="h-3.5 w-3.5" />
            30-second gift quiz
          </Link>
          <span className="text-xs text-gray-400 hidden sm:inline">or scroll to browse all 916</span>
        </div>
      </div>
    </div>
  )
}
