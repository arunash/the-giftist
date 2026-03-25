const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Find a product thumbnail image by searching multiple engines.
 * Tries Bing Images (less aggressive bot detection), then Google Shopping,
 * then DuckDuckGo as fallback.
 */
export async function findProductImage(productName: string): Promise<string | null> {
  const query = encodeURIComponent(productName)

  // Strategy 1: Bing Images (most reliable — least bot detection)
  try {
    const res = await fetch(`https://www.bing.com/images/search?q=${query}&form=HDRSC2&first=1`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const image = extractBingImage(html)
      if (image) return image
    }
  } catch {}

  // Strategy 2: Google Shopping
  try {
    const res = await fetch(`https://www.google.com/search?q=${query}&tbm=shop`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const image = extractGoogleThumbnail(html)
      if (image) return image
    }
  } catch {}

  // Strategy 3: Google Images
  try {
    const res = await fetch(`https://www.google.com/search?q=${query}&tbm=isch`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const image = extractGoogleThumbnail(html)
      if (image) return image
    }
  } catch {}

  // Strategy 4: DuckDuckGo (no tracking, less blocking)
  try {
    const res = await fetch(`https://duckduckgo.com/?q=${query}&iax=images&ia=images`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      // DDG embeds image URLs in vqd tokens and data attributes
      const imgMatch = html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s]*)?/gi)
      if (imgMatch) {
        for (const url of imgMatch) {
          if (!url.includes('duckduckgo.com') && !url.includes('icon') && !url.includes('logo')) {
            return url
          }
        }
      }
    }
  } catch {}

  return null
}

/**
 * Extract product image from Bing Images search results.
 * Bing embeds thumbnail URLs in murl/turl attributes and data-src.
 */
function extractBingImage(html: string): string | null {
  // Bing stores image URLs in murl (media URL) attribute in JSON-like data
  const murlMatches = html.match(/"murl":"(https?:[^"]+)"/g)
  if (murlMatches && murlMatches.length > 0) {
    for (const m of murlMatches) {
      const urlMatch = m.match(/"murl":"(https?:[^"]+)"/)
      if (urlMatch) {
        const url = urlMatch[1].replace(/\\u002f/g, '/').replace(/\\\//g, '/')
        // Skip tiny icons and logos
        if (url.includes('favicon') || url.includes('logo') || url.includes('icon')) continue
        return url
      }
    }
  }

  // Fallback: look for Bing thumbnail CDN URLs
  const thumbMatches = html.match(/https?:\/\/tse\d*\.mm\.bing\.net\/th[^"'\s<>]+/g)
  if (thumbMatches && thumbMatches.length > 0) {
    return thumbMatches[0].replace(/&amp;/g, '&')
  }

  return null
}

/**
 * Extract product thumbnail URLs from Google search HTML.
 */
function extractGoogleThumbnail(html: string): string | null {
  // Google's CDN-hosted product thumbnails
  const gstatic = html.match(/https?:\/\/encrypted-tbn\d*\.gstatic\.com\/images\?[^"'\s<>]+/g)
  if (gstatic && gstatic.length > 0) {
    for (const url of gstatic) {
      if (/[?&]s=([1-3]\d|[1-9])(&|$)/.test(url)) continue
      return url.replace(/&amp;/g, '&')
    }
    return gstatic[0].replace(/&amp;/g, '&')
  }

  // Shopping result images
  const shopImg = html.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:shopping|product|item)[^"]*)"/i)
  if (shopImg) return shopImg[1].replace(/&amp;/g, '&')

  return null
}
