import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Hourly: pick the N most-clicked Amazon products whose URL is still a
// search URL (/s?k=...), hit Amazon search, parse the top organic ASIN,
// and rewrite the target to /dp/ASIN. Updates both TastemakerGift and
// ProductClick rows.
//
// Affiliate commission attribution on Amazon strongly favors PDP clicks
// over search-URL clicks. ~80% of our catalog Amazon links were /s?k=
// before this ran; the offline batch already converted the top 56.
// This endpoint keeps grinding through the remaining backlog.

export const maxDuration = 60 // Vercel function timeout

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const PER_RUN = 12               // safe under 60s with 3s delays
const DELAY_MS = 3000
const CAPTCHA_QUIT_AFTER = 2     // stop after N consecutive captchas

function isCaptcha(html: string): boolean {
  if (!html || html.length < 3000) return true
  return /Type the characters you see|api-services-support@amazon|captcha|Robot Check/i.test(html)
}

function extractTopAsin(html: string): { asin: string | null; reason: string } {
  if (isCaptcha(html)) return { asin: null, reason: 'captcha-or-block' }
  const re = /<div[^>]*data-asin="([A-Z0-9]{10})"[^>]*?(data-component-type="[^"]*")?[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const asin = m[1]
    const componentType = m[2] || ''
    if (componentType.includes('sp-sponsored')) continue
    if (!asin.startsWith('B')) continue
    const window = html.slice(Math.max(0, m.index - 100), m.index + 400)
    if (/>\s*Sponsored\s*</.test(window)) continue
    return { asin, reason: 'ok' }
  }
  return { asin: null, reason: 'no-asin-found' }
}

async function fetchSearch(url: string): Promise<string | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    return await res.text()
  } catch {
    clearTimeout(t)
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  type Row = { id: string; name: string; url: string; click_total: number }
  const candidates = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT tg.id, tg.name, tg.url,
           COALESCE(SUM(pc.clicks), 0)::int as click_total
    FROM "TastemakerGift" tg
    LEFT JOIN "ProductClick" pc ON pc."productName" = tg.name
    WHERE tg."reviewStatus" = 'approved'
      AND tg.url LIKE '%amazon.com/s?k=%'
    GROUP BY tg.id, tg.name, tg.url
    ORDER BY click_total DESC, tg."totalScore" DESC NULLS LAST
    LIMIT ${PER_RUN}
  `)

  const log: { slot: number; outcome: string; asin?: string; name: string; clicks: number }[] = []
  let resolved = 0, failed = 0, captchas = 0, consecCaptchas = 0

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const html = await fetchSearch(c.url)
    const { asin, reason } = html ? extractTopAsin(html) : { asin: null, reason: 'fetch-fail' }

    if (reason === 'captcha-or-block') {
      captchas++
      consecCaptchas++
      log.push({ slot: i, outcome: 'captcha', name: c.name.slice(0, 60), clicks: c.click_total })
      if (consecCaptchas >= CAPTCHA_QUIT_AFTER) {
        log.push({ slot: -1, outcome: `BAIL: ${CAPTCHA_QUIT_AFTER} consecutive captchas`, name: '', clicks: 0 })
        break
      }
      await new Promise(r => setTimeout(r, DELAY_MS * 2))
      continue
    }
    consecCaptchas = 0

    if (!asin) {
      failed++
      log.push({ slot: i, outcome: `no-asin (${reason})`, name: c.name.slice(0, 60), clicks: c.click_total })
      await new Promise(r => setTimeout(r, DELAY_MS))
      continue
    }

    const newUrl = `https://www.amazon.com/dp/${asin}`
    await prisma.tastemakerGift.update({
      where: { id: c.id },
      data: { url: newUrl, reviewComment: `Auto-resolved search → /dp/${asin} on ${new Date().toISOString().slice(0,10)} (clicks=${c.click_total})` },
    })
    await prisma.productClick.updateMany({
      where: { productName: c.name, targetUrl: { contains: '/s?k=' } },
      data: { targetUrl: newUrl },
    })
    resolved++
    log.push({ slot: i, outcome: 'resolved', asin, name: c.name.slice(0, 60), clicks: c.click_total })
    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  // How many search URLs are left in the catalog?
  const remaining = await prisma.tastemakerGift.count({
    where: { reviewStatus: 'approved', url: { contains: 'amazon.com/s?k=' } },
  })

  return NextResponse.json({
    candidates_tried: candidates.length,
    resolved, failed, captchas,
    remaining_search_urls: remaining,
    log,
  })
}
