const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Find a product thumbnail image via Google Shopping search results.
 * Google Shopping HTML contains <img> tags with thumbnails hosted on
 * encrypted-tbn*.gstatic.com — these are reliable, fast-loading CDN URLs
 * that don't require visiting retailer pages.
 */
export async function findProductImage(productName: string): Promise<string | null> {
  const query = encodeURIComponent(productName)

  // Try Google Shopping first, then regular Google Images
  const searchUrls = [
    `https://www.google.com/search?q=${query}&tbm=shop`,
    `https://www.google.com/search?q=${query}&tbm=isch`,
  ]

  for (const searchUrl of searchUrls) {
    try {
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue

      const html = await res.text()
      const image = extractGoogleThumbnail(html)
      if (image) return image
    } catch {
      continue
    }
  }

  // Fallback: regular Google search, look for og:image in result snippets
  try {
    const res = await fetch(`https://www.google.com/search?q=${query}`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const image = extractGoogleThumbnail(html)
      if (image) return image
    }
  } catch {}

  return null
}

/**
 * Extract product thumbnail URLs from Google search HTML.
 * Looks for encrypted-tbn*.gstatic.com URLs which are Google's CDN-hosted
 * product thumbnails. Filters out tiny UI icons and logos.
 */
function extractGoogleThumbnail(html: string): string | null {
  // Match encrypted-tbn*.gstatic.com image URLs (Google's product thumbnail CDN)
  const gstatic = html.match(/https?:\/\/encrypted-tbn\d*\.gstatic\.com\/images\?[^"'\s<>]+/g)
  if (gstatic && gstatic.length > 0) {
    // Filter out tiny icons — Google uses small thumbnails for UI elements
    // Product thumbnails typically don't have explicit size params indicating tiny sizes
    for (const url of gstatic) {
      // Skip URLs that are clearly tiny UI icons (contain s=40 or similar small sizes)
      if (/[?&]s=([1-3]\d|[1-9])(&|$)/.test(url)) continue
      // Decode HTML entities that may appear in the URL
      return url.replace(/&amp;/g, '&')
    }
    // If all were filtered, return the first one anyway — better than nothing
    return gstatic[0].replace(/&amp;/g, '&')
  }

  // Fallback: look for data-src or src attributes with shopping image URLs
  const shopImg = html.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:shopping|product|item)[^"]*)"/i)
  if (shopImg) return shopImg[1].replace(/&amp;/g, '&')

  return null
}
