'use client'

import { useEffect } from 'react'

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
 */
export function ShopPageViewTracker({ path }: { path: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(SHOP_VIEW_ONCE_KEY) === path) return
    const params = new URLSearchParams(window.location.search)
    const sessionId = getSessionId()
    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: document.referrer || null,
        utmSource: params.get('utm_source'),
        utmMedium: params.get('utm_medium'),
        utmCampaign: params.get('utm_campaign'),
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
