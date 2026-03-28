import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { calculateGoalAmount } from '@/lib/platform-fee'
import { isSearchOrCategoryUrl } from '@/lib/parse-chat-content'
import crypto from 'crypto'

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Cache entries older than 7 days get re-verified
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function hashProductName(name: string): string {
  return crypto.createHash('sha256').update(name.toLowerCase().trim()).digest('hex').slice(0, 32)
}

/** Check local cache for a verified product URL */
async function getCachedProductUrl(productName: string): Promise<{ url: string; domain: string; price?: string | null; image?: string | null } | null> {
  try {
    const nameHash = hashProductName(productName)
    const cached = await prisma.productUrlCache.findUnique({ where: { nameHash } })
    if (!cached) return null

    // Check if cache is still fresh
    const age = Date.now() - cached.verifiedAt.getTime()
    if (age > CACHE_TTL_MS) return null

    return { url: cached.url, domain: cached.domain, price: cached.price, image: cached.image }
  } catch {
    return null
  }
}

/** Store a verified product URL in the cache */
async function cacheProductUrl(productName: string, url: string, domain: string, extra?: { price?: string | null; priceValue?: number | null; image?: string | null }): Promise<void> {
  try {
    const nameHash = hashProductName(productName)
    await prisma.productUrlCache.upsert({
      where: { nameHash },
      create: {
        productName: productName.toLowerCase().trim(),
        nameHash,
        url,
        domain,
        price: extra?.price || null,
        priceValue: extra?.priceValue || null,
        image: extra?.image || null,
      },
      update: {
        url,
        domain,
        price: extra?.price || null,
        priceValue: extra?.priceValue || null,
        image: extra?.image || null,
        verifiedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('[ProductCache] Failed to cache:', err)
  }
}

/**
 * Verify a product URL actually loads a valid page (not 404, not redirect to homepage/search).
 * Returns the verified (possibly redirected) URL, or null if invalid.
 */
export async function verifyProductUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })

    // Some sites block HEAD, retry with GET
    if (res.status === 405 || res.status === 403) {
      const getRes = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      })
      if (!getRes.ok) return null
      const finalUrl = getRes.url
      if (isSearchOrCategoryUrl(finalUrl)) return null
      // Check if redirected to homepage
      try {
        const u = new URL(finalUrl)
        if (u.pathname === '/' || u.pathname === '') return null
      } catch {}
      return finalUrl
    }

    if (!res.ok) return null

    const finalUrl = res.url
    if (isSearchOrCategoryUrl(finalUrl)) return null

    // Check if redirected to homepage
    try {
      const u = new URL(finalUrl)
      if (u.pathname === '/' || u.pathname === '') return null
    } catch {}

    return finalUrl
  } catch {
    return null
  }
}

// Search Google Shopping + Amazon for a real product URL (with local cache)
export async function findProductUrl(productName: string): Promise<{ url: string; domain: string } | null> {
  // Check cache first
  const cached = await getCachedProductUrl(productName)
  if (cached) {
    console.log(`[ProductCache] HIT: "${productName}" → ${cached.url}`)
    return { url: cached.url, domain: cached.domain }
  }

  const query = encodeURIComponent(productName)

  // Try Google Shopping first
  const searchUrls = [
    `https://www.google.com/search?q=${query}&tbm=shop`,
    `https://www.google.com/search?q=${query}+buy`,
  ]

  for (const searchUrl of searchUrls) {
    try {
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue

      const html = await res.text()
      const cheerio = await import('cheerio')
      const $ = cheerio.load(html)

      const productUrls: string[] = []
      // Blocked domains — not retailers
      const blockedDomains = ['google.com', 'youtube.com', 'wikipedia.org', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'pinterest.com', 'tiktok.com']
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const match = href.match(/\/url\?q=(https?:\/\/[^&]+)/)
        if (match) {
          const decoded = decodeURIComponent(match[1])
          // Accept any retailer/shop URL from Google Shopping — only block social/info sites
          const isBlocked = blockedDomains.some(d => decoded.includes(d))
          if (!isBlocked && decoded.startsWith('http')) {
            productUrls.push(decoded)
          }
        }
      })

      // Verify each URL actually loads before returning
      for (const candidateUrl of productUrls.slice(0, 3)) {
        if (isSearchOrCategoryUrl(candidateUrl)) continue
        const verified = await verifyProductUrl(candidateUrl)
        if (verified) {
          let domain = ''
          try { domain = new URL(verified).hostname } catch {}
          cacheProductUrl(productName, verified, domain).catch(() => {})
          return { url: verified, domain }
        }
      }
    } catch {
      continue
    }
  }

  // Fallback: try direct Amazon search
  try {
    const amazonUrl = `https://www.amazon.com/s?k=${query}`
    const res = await fetch(amazonUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const cheerio = await import('cheerio')
      const $ = cheerio.load(html)

      let firstProductUrl: string | null = null
      $('a[href*="/dp/"]').each((_, el) => {
        if (firstProductUrl) return
        const href = $(el).attr('href') || ''
        if (href.includes('/dp/')) {
          const dpMatch = href.match(/\/dp\/([A-Z0-9]{10})/)
          if (dpMatch) {
            firstProductUrl = `https://www.amazon.com/dp/${dpMatch[1]}`
          }
        }
      })

      if (firstProductUrl) {
        const verified = await verifyProductUrl(firstProductUrl)
        if (verified) {
          cacheProductUrl(productName, verified, 'www.amazon.com').catch(() => {})
          return { url: verified, domain: 'www.amazon.com' }
        }
      }
    }
  } catch {}

  return null
}

// Enrich an item with a real URL, image, and price
export async function enrichItem(itemId: string, productName: string): Promise<boolean> {
  try {
    // Check if already has image
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { image: true, priceValue: true, userId: true },
    })
    if (!item || item.image) return false

    const found = await findProductUrl(productName)
    if (!found) {
      console.log(`[ENRICH] No product URL found for: ${productName}`)
      return false
    }

    console.log(`[ENRICH] Found URL for "${productName}": ${found.url}`)

    let image: string | null = null
    let price: string | null = null
    let priceValue: number | null = null

    try {
      const scraped = await extractProductFromUrl(found.url)
      if (scraped.image) image = scraped.image
      if (scraped.priceValue) {
        price = scraped.price
        priceValue = scraped.priceValue
      }
    } catch (e) {
      console.log(`[ENRICH] Scrape failed for ${found.url}: ${(e as Error).message}`)
    }

    if (!image) {
      console.log(`[ENRICH] No image found for: ${productName}`)
      return false
    }

    const feeCalc = calculateGoalAmount(priceValue || item.priceValue)

    await prisma.item.update({
      where: { id: itemId },
      data: {
        image,
        url: found.url,
        domain: found.domain,
        ...(priceValue && { price, priceValue }),
        ...(feeCalc.goalAmount && { goalAmount: feeCalc.goalAmount }),
      },
    })

    console.log(`[ENRICH] Success: "${productName}" → ${found.domain}`)
    return true
  } catch (err) {
    console.error(`[ENRICH] Failed for "${productName}":`, err)
    return false
  }
}
