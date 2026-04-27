'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
import { trackClick } from '@/lib/track-click'

const WHATSAPP_URL = 'https://wa.me/15014438478'
const DISMISS_KEY = 'gf_concierge_dismissed'

function trackWaIntent(slug: string) {
  trackClick(slug, 'WA_INTENT', 'WEB')
}

/**
 * Sticky bottom CTA. Always visible on mobile, hidden on desktop.
 * Catches the bouncers — visitors who scroll past products without clicking
 * any card. Dismissible (per-session) so it doesn't annoy returning users.
 */
export function StickyConciergeBar() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true)
    }
  }, [])

  const isMothersDay = useMemo(() => {
    const occasion = searchParams.get('occasion')
    const campaign = searchParams.get('utm_campaign') || ''
    return occasion === 'mothers-day' || campaign.startsWith('md-') || campaign === 'mothers-day-shop-test'
  }, [searchParams])

  if (!mounted || dismissed) return null

  const prefill = isMothersDay
    ? `Hi! I'm shopping for a Mother's Day gift. Can you help me find something she'll love?`
    : `Hi! I need help finding a gift. Can you help me?`

  const ctaText = isMothersDay ? 'Help me pick a Mother\'s Day gift' : 'Chat with concierge — free'

  function dismiss() {
    setDismissed(true)
    if (typeof window !== 'undefined') window.sessionStorage.setItem(DISMISS_KEY, '1')
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pointer-events-none">
      <div className="bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-3 py-2.5 pointer-events-auto">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent(prefill)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaIntent('shop-sticky-wa')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#20bd5a] transition shadow-md shadow-[#25D366]/30"
          >
            <MessageCircle className="h-4 w-4" />
            {ctaText}
          </a>
          <button
            onClick={dismiss}
            aria-label="Dismiss concierge bar"
            className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
