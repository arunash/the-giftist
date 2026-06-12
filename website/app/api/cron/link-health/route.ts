import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/api-logger'

// Daily link-health check — samples N approved products, fetches the
// Amazon URL, and flags ones that look broken or mismatched.
//
// Two failure modes we look for:
//   1. HARD: page returns 404 / Amazon "not found" / redirects to homepage
//   2. SOFT: <title> tag tokens don't overlap meaningfully with our stored
//      product name — likely the scraper landed on the wrong ASIN
//
// Suspicious products get reverted to a search URL so users don't land on
// an unrelated product. Hard failures get marked rejected.
//
// Runs daily via Vercel cron. Logs a summary to ErrorLog for the admin
// digest to surface.

const SAMPLE_SIZE = 60   // ~10% of /dp/ASIN catalog per day
const TIMEOUT_MS = 12000

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Tokenize for soft-match: lowercase, strip punctuation, drop short words
function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 4)
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

async function fetchPage(url: string) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: ctrl.signal,
    })
    clearTimeout(t)
    const html = await res.text()
    return { status: res.status, finalUrl: res.url, html }
  } catch (e: any) {
    clearTimeout(t)
    return { status: 0, finalUrl: url, html: '', error: e.message }
  }
}

function buildSearchUrl(name: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(name).replace(/%20/g, '+')}`
}

interface CheckResult {
  id: string
  name: string
  url: string
  outcome: 'ok' | 'hard_fail' | 'soft_mismatch' | 'error'
  reason?: string
  jaccardScore?: number
}

async function checkProduct(p: { id: string; name: string; url: string }): Promise<CheckResult> {
  const { status, html, error } = await fetchPage(p.url)
  if (error) return { id: p.id, name: p.name, url: p.url, outcome: 'error', reason: error }
  if (status >= 400 || status === 0) {
    return { id: p.id, name: p.name, url: p.url, outcome: 'hard_fail', reason: `HTTP ${status}` }
  }
  if (/Page Not Found|We couldn'?t find that page|Sorry, we couldn'?t/i.test(html)) {
    return { id: p.id, name: p.name, url: p.url, outcome: 'hard_fail', reason: 'Amazon "not found" page' }
  }

  // Soft match: pull <title> tag, check Jaccard overlap with our product name
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const pageTitle = titleMatch?.[1] || ''
  // Strip common Amazon suffix
  const cleanedTitle = pageTitle.replace(/:\s*Amazon[^:]*$/i, '').replace(/\s*\|\s*Amazon.*/i, '')
  const ourTokens = tokens(p.name)
  const theirTokens = tokens(cleanedTitle)
  const score = jaccard(ourTokens, theirTokens)

  if (score < 0.15) {
    return {
      id: p.id, name: p.name, url: p.url,
      outcome: 'soft_mismatch',
      reason: `title overlap ${(score * 100).toFixed(0)}% — page: "${cleanedTitle.slice(0, 60)}"`,
      jaccardScore: score,
    }
  }
  return { id: p.id, name: p.name, url: p.url, outcome: 'ok', jaccardScore: score }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Sample SAMPLE_SIZE random Amazon /dp/ products. The domain field on
  // TastemakerGift isn't always populated, so match on URL contents instead.
  const total = await prisma.tastemakerGift.count({
    where: { reviewStatus: 'approved', url: { contains: 'amazon.com/dp/' } },
  })
  if (total === 0) return NextResponse.json({ checked: 0, message: 'no PDP products to check' })

  const products = await prisma.$queryRaw<{ id: string; name: string; url: string }[]>`
    SELECT id, name, url FROM "TastemakerGift"
    WHERE "reviewStatus" = 'approved' AND url LIKE '%amazon.com/dp/%'
    ORDER BY RANDOM() LIMIT ${SAMPLE_SIZE}
  `

  const results: CheckResult[] = []
  for (const p of products) {
    const r = await checkProduct(p)
    results.push(r)
    // Polite delay to avoid Amazon rate-limiting
    await new Promise(r => setTimeout(r, 2500 + Math.random() * 1500))
  }

  const ok = results.filter(r => r.outcome === 'ok').length
  const hard = results.filter(r => r.outcome === 'hard_fail')
  const soft = results.filter(r => r.outcome === 'soft_mismatch')
  const errors = results.filter(r => r.outcome === 'error')

  // Auto-revert hard failures + soft mismatches to search URLs so users
  // don't land on broken or wrong product pages.
  for (const r of [...hard, ...soft]) {
    const newUrl = buildSearchUrl(r.name)
    await prisma.tastemakerGift.update({
      where: { id: r.id },
      data: { url: newUrl, reviewComment: `link-health auto-revert: ${r.reason?.slice(0, 80)}` },
    }).catch(() => {})
    await prisma.productClick.updateMany({
      where: { productName: r.name },
      data: { targetUrl: newUrl },
    }).catch(() => {})
  }

  // Log a summary so the admin digest picks it up
  if (hard.length > 0 || soft.length > 0) {
    await logError({
      source: 'LINK_HEALTH',
      message: `Daily check: ${results.length} sampled · ${ok} ok · ${hard.length} hard fails · ${soft.length} soft mismatches · ${errors.length} errors. Auto-reverted ${hard.length + soft.length} to search URLs.`,
      metadata: {
        hardFails: hard.map(r => ({ name: r.name, reason: r.reason })),
        softMismatches: soft.slice(0, 10).map(r => ({ name: r.name, jaccard: r.jaccardScore, reason: r.reason })),
      },
    }).catch(() => {})
  }

  // ── Gift-send health (added per user request after a "Continue to
  //    payment" button silently failed on a product with no priceValue) ──
  const totalProducts = await prisma.productClick.count()
  const noPrice = await prisma.productClick.count({ where: { priceValue: null } })
  const giftEligible = totalProducts - noPrice
  const giftEligiblePct = totalProducts > 0 ? Math.round((giftEligible / totalProducts) * 100) : 0

  // Page-render health: hit the listicle + magic + a known-good /p/SLUG
  // and check they return 200. Catches deploy regressions.
  const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
  const pages = [
    `${baseUrl}/`,
    `${baseUrl}/guides/mothers-day-under-50`,
    `${baseUrl}/magic`,
  ]
  const pageHealth: Record<string, number> = {}
  for (const url of pages) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      pageHealth[new URL(url).pathname] = r.status
    } catch {
      pageHealth[new URL(url).pathname] = 0
    }
  }

  const pageFails = Object.entries(pageHealth).filter(([_, s]) => s !== 200)
  if (pageFails.length > 0 || giftEligiblePct < 75) {
    await logError({
      source: 'HEALTH_CHECK',
      message: `Daily health: gift-eligible ${giftEligible}/${totalProducts} (${giftEligiblePct}%) · page failures: ${pageFails.length > 0 ? pageFails.map(([p, s]) => `${p}=${s}`).join(', ') : 'none'}`,
      metadata: { giftEligible, totalProducts, giftEligiblePct, pageHealth, noPriceCount: noPrice },
    }).catch(() => {})
  }

  console.log(`[link-health] ${results.length} checked · ${ok} ok · ${hard.length} hard · ${soft.length} soft · ${errors.length} err`)
  console.log(`[gift-health] ${giftEligible}/${totalProducts} gift-eligible (${giftEligiblePct}%) · pages: ${JSON.stringify(pageHealth)}`)

  return NextResponse.json({
    checked: results.length,
    ok,
    hardFails: hard.length,
    softMismatches: soft.length,
    errors: errors.length,
    autoReverted: hard.length + soft.length,
    giftEligible,
    giftEligiblePct,
    pageHealth,
  })
}
