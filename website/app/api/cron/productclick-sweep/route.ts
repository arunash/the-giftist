import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Hourly sweep: every ProductClick row whose targetUrl points at a retailer
// homepage gets rewritten to a useful destination. Homepage = path is '' or '/'.
//
// Why: createTrackedLink dedups by (productName, targetUrl), so if the
// upstream TastemakerGift URL was updated, the old ProductClick row stays
// around — and any old /go-r/<slug> link in the wild (or any card that
// matches the prior (name, url) pair) still 302s to the dead homepage.
//
// Strategy:
// - Amazon homepages → Amazon search URL with the product name. Affiliate
//   tag is applied by /go-r/ at request time so we still earn commission.
// - Any other homepage → Google "<name> buy" search. No commission but no
//   dead-end either.

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await prisma.productClick.findMany({
    select: { slug: true, productName: true, targetUrl: true },
  })

  const stales: typeof rows = []
  for (const r of rows) {
    try {
      const u = new URL(r.targetUrl)
      const path = u.pathname.replace(/\/+$/, '')
      if (!path || path === '') stales.push(r)
    } catch {
      stales.push(r)
    }
  }

  let amazonFixed = 0
  let googleFallback = 0
  for (const r of stales) {
    let host = ''
    try { host = new URL(r.targetUrl).hostname.toLowerCase() } catch {}
    const isAmazon = host.includes('amazon.com') || host === 'amzn.to' || host.includes('amazon.co')
    const newUrl = isAmazon
      ? `https://www.amazon.com/s?k=${encodeURIComponent(r.productName)}`
      : `https://www.google.com/search?q=${encodeURIComponent(r.productName + ' buy')}`
    try {
      await prisma.productClick.update({
        where: { slug: r.slug },
        data: { targetUrl: newUrl },
      })
      if (isAmazon) amazonFixed++
      else googleFallback++
    } catch {
      // skip individual update failures (rare race conditions)
    }
  }

  return NextResponse.json({
    scanned: rows.length,
    stale_found: stales.length,
    amazon_to_search: amazonFixed,
    other_to_google_fallback: googleFallback,
  })
}
