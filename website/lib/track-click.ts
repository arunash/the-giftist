/**
 * Browser-side click-event tracker. Reads sessionId + utm_* from sessionStorage
 * (populated by ShopPageViewTracker on /shop landing) so every CTA event can be
 * attributed back to a Meta campaign / UTM source.
 *
 * Used by: shop card CARD_CLICK, /p/SLUG WA_INTENT, shop hero/sticky WA_INTENT.
 *
 * Fire-and-forget. Never throws. Uses keepalive so it survives the browser
 * navigating away mid-flight.
 */

const SESSION_KEY = 'gf_sid'
const ATTRIBUTION_KEY = 'gf_attribution'

interface Attribution {
  utmSource?: string | null
  utmCampaign?: string | null
}

function getAttribution(): Attribution & { sessionId: string } {
  if (typeof window === 'undefined') return { sessionId: '', utmSource: null, utmCampaign: null }
  let sessionId = window.sessionStorage.getItem(SESSION_KEY) || ''
  let attr: Attribution = {}
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY)
    if (raw) attr = JSON.parse(raw)
  } catch {}
  // Also read live from URL — covers cases where we click before
  // ShopPageViewTracker has run.
  if (!attr.utmCampaign && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const utmCampaign = params.get('utm_campaign')
    const utmSource = params.get('utm_source')
    if (utmCampaign) attr.utmCampaign = utmCampaign
    if (utmSource) attr.utmSource = utmSource
  }
  return { sessionId, utmSource: attr.utmSource ?? null, utmCampaign: attr.utmCampaign ?? null }
}

export function persistAttribution(utmSource: string | null, utmCampaign: string | null): void {
  if (typeof window === 'undefined') return
  if (!utmSource && !utmCampaign) return
  // Don't overwrite an existing attribution — first-touch wins for the session.
  const existing = window.sessionStorage.getItem(ATTRIBUTION_KEY)
  if (existing) return
  window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ utmSource, utmCampaign }))
}

export type ClickEvent =
  | 'CARD_CLICK'
  | 'WA_INTENT'
  | 'PAGE_VIEW'
  | 'IMPRESSION'
  | 'RETAILER_CLICK'

export function trackClick(slug: string, event: ClickEvent, channel: 'WEB' | 'WHATSAPP' = 'WEB'): void {
  if (typeof window === 'undefined') return
  const attr = getAttribution()
  fetch('/api/analytics/click-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug, event, channel,
      utmSource: attr.utmSource,
      utmCampaign: attr.utmCampaign,
      sessionId: attr.sessionId,
    }),
    keepalive: true,
  }).catch(() => {})
}
