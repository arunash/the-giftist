const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Minimum acceptable image dimensions (skip tiny thumbnails)
const MIN_IMAGE_BYTES = 5000

/**
 * Find a high-quality product image by searching multiple engines.
 * Prioritizes full-resolution source images over thumbnails.
 */
export async function findProductImage(productName: string): Promise<string | null> {
  const query = encodeURIComponent(productName)

  // Strategy 1: Bing Images — extract full-res source URLs (murl), not thumbnails
  try {
    const res = await fetch(`https://www.bing.com/images/search?q=${query}+product&form=HDRSC2&first=1`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const image = extractBingFullRes(html)
      if (image) return image
    }
  } catch {}

  // Strategy 2: Google Shopping — try to get actual product page images
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
      const image = extractGoogleFullRes(html)
      if (image) return image
    }
  } catch {}

  // Strategy 3: Google Images — extract source URLs from data attributes
  try {
    const res = await fetch(`https://www.google.com/search?q=${query}+product&tbm=isch`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const image = extractGoogleFullRes(html)
      if (image) return image
    }
  } catch {}

  // Strategy 4: DuckDuckGo
  try {
    const res = await fetch(`https://duckduckgo.com/?q=${query}&iax=images&ia=images`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const imgMatch = html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s]*)?/gi)
      if (imgMatch) {
        for (const url of imgMatch) {
          if (!url.includes('duckduckgo.com') && !url.includes('icon') && !url.includes('logo') && !url.includes('favicon')) {
            return url
          }
        }
      }
    }
  } catch {}

  return null
}

/**
 * Extract FULL-RESOLUTION image URLs from Bing Images.
 * Bing stores the original source URL in "murl" (media URL) — these are
 * full-res images from the original websites, NOT thumbnails.
 */
function extractBingFullRes(html: string): string | null {
  // murl = original source image (full resolution)
  const murlMatches = html.match(/"murl":"(https?:[^"]+)"/g)
  if (murlMatches && murlMatches.length > 0) {
    const candidates: string[] = []
    for (const m of murlMatches) {
      const urlMatch = m.match(/"murl":"(https?:[^"]+)"/)
      if (!urlMatch) continue
      let url = urlMatch[1]
        .replace(/\\u002f/g, '/')
        .replace(/\\\//g, '/')
        .replace(/\\u0026/g, '&')
      // Skip icons, logos, SVGs, and tiny images
      if (/favicon|logo|icon|\.svg|badge|sprite/i.test(url)) continue
      // Prefer common product image patterns
      if (/\.(jpg|jpeg|png|webp)/i.test(url)) {
        candidates.push(url)
      }
    }

    // Prefer images from known retailers or with 'product' in URL
    for (const url of candidates) {
      if (/amazon|walmart|target|etsy|nordstrom|bestbuy|product|images.*large/i.test(url)) {
        return url
      }
    }
    // Otherwise return the first valid candidate
    if (candidates.length > 0) return candidates[0]
  }

  // Fallback: Bing CDN thumbnails (still better than nothing, but lower quality)
  const thumbMatches = html.match(/https?:\/\/tse\d*\.mm\.bing\.net\/th[^"'\s<>]+/g)
  if (thumbMatches && thumbMatches.length > 0) {
    // Request larger thumbnail by modifying the URL
    let url = thumbMatches[0].replace(/&amp;/g, '&')
    // If it has w= and h= params, bump them up
    if (url.includes('&w=') || url.includes('?w=')) {
      url = url.replace(/([?&])w=\d+/, '$1w=600').replace(/([?&])h=\d+/, '$1h=600')
    }
    return url
  }

  return null
}

/**
 * Extract images from Google search results.
 * Tries to find full-resolution source URLs embedded in JavaScript data,
 * falls back to encrypted-tbn thumbnails.
 */
function extractGoogleFullRes(html: string): string | null {
  // Google Images embeds full-res source URLs in JS arrays and data attributes
  // Pattern: ["https://example.com/image.jpg",width,height]
  const jsImagePattern = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)",\s*(\d+),\s*(\d+)\]/g
  let bestUrl: string | null = null
  let bestArea = 0
  let match
  while ((match = jsImagePattern.exec(html)) !== null) {
    const url = match[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')
    const width = parseInt(match[2])
    const height = parseInt(match[3])
    // Skip tiny images and Google's own assets
    if (width < 200 || height < 200) continue
    if (url.includes('google.com') || url.includes('gstatic.com') || url.includes('googleapis.com')) continue
    if (/favicon|logo|icon|sprite|badge/i.test(url)) continue
    const area = width * height
    if (area > bestArea) {
      bestArea = area
      bestUrl = url
    }
  }
  if (bestUrl) return bestUrl

  // Fallback: Google Shopping data-src with larger images
  const dataSrcMatches = html.match(/data-src="(https?:\/\/[^"]+)"/g)
  if (dataSrcMatches) {
    for (const m of dataSrcMatches) {
      const urlMatch = m.match(/data-src="(https?:\/\/[^"]+)"/)
      if (!urlMatch) continue
      const url = urlMatch[1].replace(/&amp;/g, '&')
      if (url.includes('gstatic.com') && !url.includes('encrypted-tbn')) continue
      if (url.includes('shopping') || url.includes('product') || url.includes('images')) {
        return url
      }
    }
  }

  // Last resort: encrypted-tbn thumbnails (low quality)
  const gstatic = html.match(/https?:\/\/encrypted-tbn\d*\.gstatic\.com\/images\?[^"'\s<>]+/g)
  if (gstatic && gstatic.length > 0) {
    for (const url of gstatic) {
      if (/[?&]s=([1-3]\d|[1-9])(&|$)/.test(url)) continue
      return url.replace(/&amp;/g, '&')
    }
    return gstatic[0].replace(/&amp;/g, '&')
  }

  return null
}
