'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem('giftist_sid')
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('giftist_sid', sid)
  }
  return sid
}

function PageTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return

    const utmSource = searchParams.get('utm_source')
    const utmMedium = searchParams.get('utm_medium')
    const utmCampaign = searchParams.get('utm_campaign')

    // Store UTM params in sessionStorage so they persist across page loads
    if (utmSource) sessionStorage.setItem('giftist_utm_source', utmSource)
    if (utmMedium) sessionStorage.setItem('giftist_utm_medium', utmMedium)
    if (utmCampaign) sessionStorage.setItem('giftist_utm_campaign', utmCampaign)

    const data = {
      path: pathname,
      referrer: document.referrer || null,
      utmSource: utmSource || sessionStorage.getItem('giftist_utm_source') || null,
      utmMedium: utmMedium || sessionStorage.getItem('giftist_utm_medium') || null,
      utmCampaign: utmCampaign || sessionStorage.getItem('giftist_utm_campaign') || null,
      sessionId: getSessionId(),
    }

    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(() => {})
  }, [pathname, searchParams])

  return null
}

export function PageTracker() {
  return (
    <PageTrackerInner />
  )
}
