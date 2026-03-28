import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { calculateGoalAmount } from '@/lib/platform-fee'
import { isSearchOrCategoryUrl } from '@/lib/parse-chat-content'
import { searchRetailers } from '@/lib/search-retailers'
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

// Retailers that block server-side requests but work for real users.
// Trust URLs from these domains if they have a valid product path pattern.
const TRUSTED_RETAILERS: Record<string, RegExp> = {
  'bestbuy.com': /\/(site|product)\/.+/,
  'nordstrom.com': /\/s\/.+/,  // Nordstrom uses /s/ for product pages
  'target.com': /\/p\/.+/,
  'macys.com': /\/shop\/product\/.+/,
  'walmart.com': /\/ip\/\d+/,  // Walmart product pages are /ip/{id}
  'amazon.com': /\/dp\/[A-Z0-9]{10}/,
}

function isTrustedRetailerUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')
    for (const [domain, pattern] of Object.entries(TRUSTED_RETAILERS)) {
      if (host.includes(domain) && pattern.test(u.pathname)) return true
    }
    return false
  } catch { return false }
}

/**
 * Verify a product URL actually loads a valid page (not 404, not redirect to homepage/search).
 * Returns the verified (possibly redirected) URL, or null if invalid.
 */
export async function verifyProductUrl(url: string): Promise<string | null> {
  // Some retailers block all server requests — trust them if URL pattern looks right
  if (isTrustedRetailerUrl(url) && !isSearchOrCategoryUrl(url)) {
    return url
  }

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
      try {
        const u = new URL(finalUrl)
        if (u.pathname === '/' || u.pathname === '') return null
        if (u.pathname.includes('/blocked') || u.pathname.includes('/captcha') || u.pathname.includes('/robot')) return null
      } catch {}
      return finalUrl
    }

    if (!res.ok) return null

    const finalUrl = res.url
    if (isSearchOrCategoryUrl(finalUrl)) return null

    try {
      const u = new URL(finalUrl)
      if (u.pathname === '/' || u.pathname === '') return null
      // Catch bot-block redirect pages (e.g. walmart.com/blocked)
      if (u.pathname.includes('/blocked') || u.pathname.includes('/captcha') || u.pathname.includes('/robot')) return null
    } catch {}

    return finalUrl
  } catch {
    // Connection refused / timeout — check if it's a known retailer with valid URL pattern
    if (isTrustedRetailerUrl(url)) return url
    return null
  }
}

export interface ProductUrlResult {
  url: string
  domain: string
  price?: string | null
  priceValue?: number | null
}

// Find a verified product URL using GPT-4o web search (with local cache)
export async function findProductUrl(productName: string): Promise<ProductUrlResult | null> {
  // Check cache first
  const cached = await getCachedProductUrl(productName)
  if (cached) {
    console.log(`[ProductCache] HIT: "${productName}" → ${cached.url} (${cached.price || 'no price'})`)
    return { url: cached.url, domain: cached.domain, price: cached.price }
  }

  console.log(`[ProductSearch] Searching for: "${productName}"`)

  // Use GPT-4o with web search to find real product URLs + current prices
  try {
    const { results } = await searchRetailers(productName, null, null)

    for (const result of results.slice(0, 3)) {
      if (isSearchOrCategoryUrl(result.url)) {
        console.log(`[ProductSearch] Skipping search URL: ${result.url}`)
        continue
      }

      const verified = await verifyProductUrl(result.url)
      if (verified) {
        let domain = ''
        try { domain = new URL(verified).hostname } catch {}
        console.log(`[ProductSearch] Verified: "${productName}" → ${verified} (${result.price || 'no price'})`)
        cacheProductUrl(productName, verified, domain, {
          price: result.price,
          priceValue: result.priceValue,
        }).catch(() => {})
        return { url: verified, domain, price: result.price, priceValue: result.priceValue }
      } else {
        console.log(`[ProductSearch] Failed verification: ${result.url}`)
      }
    }
  } catch (err) {
    console.error(`[ProductSearch] GPT-4o search failed:`, err)
  }

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

    console.log(`[ENRICH] Found URL for "${productName}": ${found.url} (${found.price || 'no price'})`)

    let image: string | null = null
    // Prefer real price from web search over scraped price
    let price: string | null = found.price || null
    let priceValue: number | null = found.priceValue || null

    try {
      const scraped = await extractProductFromUrl(found.url)
      if (scraped.image) image = scraped.image
      // Only use scraped price if web search didn't find one
      if (!price && scraped.priceValue) {
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
