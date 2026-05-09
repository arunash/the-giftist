// On-demand Amazon price scraper. Used by /api/p/[slug] when ProductClick
// has no priceValue — fetches the Amazon page, parses the price, and caches
// it back to the DB so subsequent page views are instant.
//
// Returns null on captcha / block / no-match — caller falls back to the
// custom-amount picker UI.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const TIMEOUT_MS = 6000  // page load latency cap

/**
 * Try to extract a USD price from Amazon HTML. Multiple fallback selectors
 * because Amazon's markup varies between PDP, search results, and Kindle pages.
 */
function extractPriceFromHtml(html: string): number | null {
  if (!html) return null

  // Captcha / block detection
  if (/Type the characters you see in this image|api-services-support@amazon|captcha/i.test(html)) {
    return null
  }
  // Generic block page (Amazon serving us a stripped-down HTML)
  if (html.length < 5000 && /<title[^>]*>Amazon\.com<\/title>/i.test(html)) {
    return null
  }

  // Strategy 1: a-offscreen — Amazon's accessible price text "$15.99"
  // Most reliable across PDP + search results.
  const offscreenMatches = html.match(/<span class="a-offscreen">\s*\$([0-9,]+\.?[0-9]*)\s*<\/span>/g) || []
  for (const m of offscreenMatches) {
    const num = m.match(/\$([0-9,]+\.?[0-9]*)/)?.[1]
    if (num) {
      const price = parseFloat(num.replace(/,/g, ''))
      if (price > 0.5 && price < 5000) return price
    }
  }

  // Strategy 2: a-price-whole + a-price-fraction
  const wholeMatch = html.match(/<span class="a-price-whole">([0-9,]+)/)
  const fractionMatch = html.match(/<span class="a-price-fraction">([0-9]+)/)
  if (wholeMatch?.[1]) {
    const whole = parseFloat(wholeMatch[1].replace(/,/g, ''))
    const frac = fractionMatch?.[1] ? parseFloat('0.' + fractionMatch[1]) : 0
    const price = whole + frac
    if (price > 0.5 && price < 5000) return price
  }

  return null
}

export async function scrapeAmazonPrice(url: string): Promise<number | null> {
  if (!url) return null
  const lower = url.toLowerCase()
  if (!lower.includes('amazon.com') && !lower.includes('amzn.to')) return null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = await res.text()
    return extractPriceFromHtml(html)
  } catch {
    clearTimeout(timer)
    return null
  }
}
