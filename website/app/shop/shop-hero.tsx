'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, Sparkles, Star, ArrowDown, Wand2 } from 'lucide-react'
import { trackClick } from '@/lib/track-click'

const WHATSAPP_URL = 'https://wa.me/15014438478'

// Father's Day 2026 — 3rd Sunday of June
const FATHERS_DAY = new Date(2026, 5, 21) // June 21, 2026

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

function trackWaIntent(slug: string) {
  trackClick(slug, 'WA_INTENT', 'WEB')
}

export function ShopHero() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isFathersDay = useMemo(() => {
    const occasion = searchParams.get('occasion')
    const campaign = searchParams.get('utm_campaign') || ''
    return occasion === 'fathers-day' || campaign.startsWith('fd-') || campaign === 'fathers-day-shop-test'
  }, [searchParams])

  // Post-gift-redemption: recipient just shipped their gift; we land them
  // here to convert them into a sender. Show a warm banner above whatever
  // hero would otherwise render.
  const fromGiftRedeem = mounted && searchParams.get('from') === 'gift-redeem'
  const senderName = mounted ? (searchParams.get('recipient') || '') : ''

  const fd = useMemo(() => {
    const days = daysUntil(FATHERS_DAY)
    return {
      days,
      daysLabel: days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`,
      shipBy: new Date(FATHERS_DAY.getTime() - 3 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  }, [])

  // ── Post-gift-redemption — recipient just shipped their gift ──
  if (fromGiftRedeem) {
    return (
      <section className="bg-gradient-to-b from-violet-50 to-white border-b border-violet-100">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <h1 className="font-serif text-3xl sm:text-4xl text-gray-900 leading-tight tracking-tight mb-3">
            Your gift is on its way
          </h1>
          <p className="text-base text-gray-600 leading-relaxed mb-2">
            {senderName ? <>{senderName} sent you something thoughtful.</> : <>Someone sent you something thoughtful.</>}
            {' '}Now browse and send a gift of your own.
          </p>
          <p className="text-xs text-gray-400">
            Pick someone, set a budget, we&apos;ll handle the rest — same way it just happened for you.
          </p>
        </div>
      </section>
    )
  }

  // ── Father's Day variant — above-the-fold conversion engine ──
  if (mounted && isFathersDay) {
    const waPrefill = `Hi! I'm shopping for a Father's Day gift. Can you help me find something he'll love?`
    return (
      <section className="bg-gradient-to-b from-sky-50 to-white border-b border-sky-100">
        <div className="max-w-6xl mx-auto px-4 pt-10 pb-8 sm:pt-14 sm:pb-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 bg-sky-100 text-sky-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <Sparkles className="h-3 w-3" />
              Father's Day · {fd.daysLabel}
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
              Find Dad a gift he&apos;ll <span className="text-sky-700">actually</span> love
            </h1>
            <p className="text-gray-600 mt-4 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              700+ hand-picked gifts vetted by Wirecutter, The Strategist, and Reddit. Order by <span className="font-semibold text-gray-900">{fd.shipBy}</span> to ship in time.
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
                href="/magic"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-900 text-base font-semibold px-6 py-3.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition"
              >
                <Wand2 className="h-4 w-4" />
                Magic gift finder
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
          Send a gift they&apos;ll actually love.
          <br />
          <span className="text-primary">Or cash if they don&apos;t.</span>
        </h1>
        <p className="text-gray-500 mt-3 text-base sm:text-lg leading-relaxed">
          Pick anything — they choose ship, cash, or wallet. No wrong gifts, no awkward exchanges. Curated by Wirecutter, NY Mag, and real reviews.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center items-center mt-5">
          <Link
            href="/magic"
            className="inline-flex items-center gap-1.5 bg-pink-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-pink-600 transition shadow-sm"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Magic gift finder
          </Link>
          <span className="text-xs text-gray-400 hidden sm:inline">or scroll to browse</span>
        </div>
      </div>
    </div>
  )
}
