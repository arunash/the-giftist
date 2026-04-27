'use client'

// Exit-intent + dwell-stuck concierge popup.
// Triggers once per session when:
//   - mouse leaves the top edge of the viewport (desktop exit-intent), OR
//   - user has dwelled 60s with no card-engagement click.
// Suppressed if user has already engaged (clicked a product card or buy link).

import { useEffect, useState } from 'react'
import { X, MessageCircle, Sparkles } from 'lucide-react'
import { trackClick } from '@/lib/track-click'

const WHATSAPP_URL = 'https://wa.me/15014438478'
const STORAGE_KEY = 'giftist:concierge-popup-shown'
const DWELL_MS = 60_000

export function ExitIntentConcierge() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(STORAGE_KEY)) return

    let engaged = false
    let dwellTimer: ReturnType<typeof setTimeout> | null = null
    let armed = true

    const trigger = () => {
      if (!armed || engaged) return
      if (sessionStorage.getItem(STORAGE_KEY)) return
      armed = false
      sessionStorage.setItem(STORAGE_KEY, '1')
      setOpen(true)
    }

    const onMouseLeave = (e: MouseEvent) => {
      // Only fire on top-edge exit (mouse heading for tab/url bar)
      if (e.clientY <= 0) trigger()
    }

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      // Any click on a product link, buy button, or carousel card counts as engaged
      if (t.closest('a[href*="/p/"], a[href*="/go-r/"], a[href*="wa.me"], button[type="button"]')) {
        engaged = true
      }
    }

    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('click', onClick)
    dwellTimer = setTimeout(trigger, DWELL_MS)

    return () => {
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('click', onClick)
      if (dwellTimer) clearTimeout(dwellTimer)
    }
  }, [])

  if (!open) return null

  const waText = "Hi! I'm browsing gifts but feeling stuck. Can you help me pick something?"
  const waHref = `${WHATSAPP_URL}?text=${encodeURIComponent(waText)}`

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl m-0 sm:m-4 animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition z-10"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="h-4 w-4 text-pink-500" />
            <p className="text-[10px] uppercase tracking-wider text-pink-500 font-bold">
              Stuck? Skip the scroll.
            </p>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-2">
            Tell me about them — I&apos;ll pick 3.
          </h2>

          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            Their age, hobbies, your budget — that&apos;s all I need.
            I&apos;ll send 3 perfect picks within minutes, hand-curated for them.
          </p>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackClick('shop-exit-popup', 'WA_INTENT', 'WEB')
              setOpen(false)
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#25D366] text-white rounded-xl font-semibold text-sm hover:bg-[#20bd5a] transition shadow-md shadow-emerald-500/30"
          >
            <MessageCircle className="h-4 w-4" />
            Chat with Giftist on WhatsApp
          </a>

          <button
            onClick={() => setOpen(false)}
            className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            No thanks, I&apos;ll keep browsing
          </button>

          <p className="text-[10px] text-center text-gray-300 mt-3">
            Free · No app needed · Reply anytime
          </p>
        </div>
      </div>
    </div>
  )
}
