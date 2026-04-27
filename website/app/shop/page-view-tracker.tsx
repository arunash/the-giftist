'use client'

import { useEffect } from 'react'
import { persistAttribution } from '@/lib/track-click'

const SESSION_KEY = 'gf_sid'
const SHOP_VIEW_ONCE_KEY = 'gf_shop_view_sent'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = window.sessionStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem(SESSION_KEY, sid)
  }
  return sid
}

/**
 * Fires a single PageView for /shop per session, capturing utm_* params.
 * Used to attribute ad-driven landings to specific Meta campaigns.
 *
 * Also persists utm_source + utm_campaign to sessionStorage (first-touch)
 * so downstream CTA clicks can attribute themselves back to the campaign
 * even if the user navigates away from the original landing URL.
 */
export function ShopPageViewTracker({ path }: { path: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const utmSource = params.get('utm_source')
    const utmCampaign = params.get('utm_campaign')

    // Persist attribution immediately (independent of pageview send)
    persistAttribution(utmSource, utmCampaign)

    if (window.sessionStorage.getItem(SHOP_VIEW_ONCE_KEY) === path) return
    const sessionId = getSessionId()
    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: document.referrer || null,
        utmSource,
        utmMedium: params.get('utm_medium'),
        utmCampaign,
        sessionId,
      }),
      keepalive: true,
    })
      .then(() => {
        window.sessionStorage.setItem(SHOP_VIEW_ONCE_KEY, path)
      })
      .catch(() => {})
  }, [path])
  return null
}
