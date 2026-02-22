import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { calculateGoalAmount } from '@/lib/platform-fee'

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Search Google Shopping + Amazon for a real product URL
export async function findProductUrl(productName: string): Promise<{ url: string; domain: string } | null> {
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
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const match = href.match(/\/url\?q=(https?:\/\/[^&]+)/)
        if (match) {
          const decoded = decodeURIComponent(match[1])
          if (
            (decoded.includes('amazon.com') ||
              decoded.includes('target.com') ||
              decoded.includes('walmart.com') ||
              decoded.includes('bestbuy.com') ||
              decoded.includes('etsy.com') ||
              decoded.includes('nordstrom.com') ||
              decoded.includes('wayfair.com') ||
              decoded.includes('kohls.com') ||
              decoded.includes('macys.com') ||
              decoded.includes('barnesandnoble.com') ||
              decoded.includes('bookshop.org')) &&
            !decoded.includes('google.com')
          ) {
            productUrls.push(decoded)
          }
        }
      })

      if (productUrls.length > 0) {
        const url = productUrls[0]
        let domain = ''
        try { domain = new URL(url).hostname } catch {}
        return { url, domain }
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
        return { url: firstProductUrl, domain: 'www.amazon.com' }
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
