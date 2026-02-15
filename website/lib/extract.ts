import * as cheerio from 'cheerio'
import { isPrivateUrl } from './url-safety'

export interface ProductInfo {
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  url: string
  domain: string
}

// --- Helpers ---

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim().substring(0, 200)
}

function cleanPrice(text: string): string {
  const match = text.match(/[$£€¥₹]?\s*[\d,]+\.?\d*/)
  return match ? match[0].trim() : text.trim().substring(0, 20)
}

function extractPriceValue(text: string): number | null {
  const numbers = text.replace(/[^0-9.]/g, '')
  const value = parseFloat(numbers)
  return isNaN(value) ? null : value
}

function formatPrice(price: number | string, currency = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', CAD: 'CA$', AUD: 'A$',
  }
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${parseFloat(String(price)).toFixed(2)}`
}

// --- Extraction strategies ---

function extractFromJsonLd($: cheerio.CheerioAPI): Partial<ProductInfo> | null {
  const scripts = $('script[type="application/ld+json"]')
  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse($(scripts[i]).html() || '')
      const product = findProductInJsonLd(data)
      if (product) return product
    } catch {
      // invalid JSON, skip
    }
  }
  return null
}

function findProductInJsonLd(data: any): Partial<ProductInfo> | null {
  if (!data) return null
  if (Array.isArray(data)) {
    for (const item of data) {
      const result = findProductInJsonLd(item)
      if (result) return result
    }
    return null
  }
  if (data['@type'] === 'Product' || data['@type']?.includes?.('Product')) {
    const offers = data.offers
    const offer = Array.isArray(offers) ? offers[0] : offers
    const price = offer?.price || offer?.lowPrice
    const currency = offer?.priceCurrency || 'USD'
    const image = data.image
    return {
      name: data.name,
      price: price ? formatPrice(price, currency) : null,
      priceValue: price ? parseFloat(price) : null,
      image: typeof image === 'string' ? image : Array.isArray(image) ? image[0] : image?.url || image?.['@id'] || null,
    }
  }
  if (data['@graph']) return findProductInJsonLd(data['@graph'])
  return null
}

function extractFromOpenGraph($: cheerio.CheerioAPI): Partial<ProductInfo> | null {
  const getMeta = (prop: string) =>
    $(`meta[property="${prop}"], meta[name="${prop}"]`).attr('content') || null

  const title = getMeta('og:title') || getMeta('twitter:title')
  const image = getMeta('og:image') || getMeta('twitter:image')
  const priceAmount = getMeta('product:price:amount') || getMeta('og:price:amount')
  const priceCurrency = getMeta('product:price:currency') || getMeta('og:price:currency') || 'USD'

  if (title || image) {
    return {
      name: title || undefined,
      price: priceAmount ? formatPrice(priceAmount, priceCurrency) : null,
      priceValue: priceAmount ? parseFloat(priceAmount) : null,
      image,
    }
  }
  return null
}

const NAME_SELECTORS = [
  '#productTitle', '#title',
  'h1[itemprop="name"]', '[data-testid="product-title"]',
  '.product-title', '.product-name', '.pdp-title',
  '.product__title', '.product-single__title',
  '.product_title',
  '.x-item-title__mainTitle',
  '[data-test="product-title"]',
  '[itemprop="name"]',
  'h1',
]

const PRICE_SELECTORS = [
  '.a-price .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice', '.a-price-whole',
  '[itemprop="price"]', '[data-testid="product-price"]',
  '.product-price', '.price', '.pdp-price',
  '.product__price', '.price__current',
  '.woocommerce-Price-amount',
  '.x-price-primary',
  '[data-test="product-price"]',
  '.price-characteristic',
]

const IMAGE_SELECTORS = [
  '#landingImage', '#imgBlkFront',
  '[itemprop="image"]',
  '.product-image img', '.product-gallery img', '.pdp-image img',
  '.product__media img', '.product-single__photo img',
  '.woocommerce-product-gallery img',
  '.ux-image-carousel img',
  '[data-test="product-image"] img',
  'img[src*="product"]', 'main img',
]

function extractFromDOM($: cheerio.CheerioAPI): Partial<ProductInfo> {
  const findFirst = (selectors: string[], attr: 'text' | 'src') => {
    for (const sel of selectors) {
      try {
        const el = $(sel).first()
        if (!el.length) continue
        if (attr === 'text') {
          const text = el.text()?.trim()
          if (text) return text
        } else {
          const src = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src')
          if (src) return src
        }
      } catch {
        // invalid selector
      }
    }
    return null
  }

  const name = findFirst(NAME_SELECTORS, 'text')
  const priceText = findFirst(PRICE_SELECTORS, 'text')
  const image = findFirst(IMAGE_SELECTORS, 'src')

  return {
    name: name ? cleanText(name) : undefined,
    price: priceText ? cleanPrice(priceText) : null,
    priceValue: priceText ? extractPriceValue(priceText) : null,
    image,
  }
}

// --- Main export ---

export async function extractProductFromUrl(url: string): Promise<ProductInfo> {
  const parsedUrl = new URL(url)
  const domain = parsedUrl.hostname

  // SSRF protection: block requests to private/internal networks
  if (isPrivateUrl(parsedUrl)) {
    throw new Error('URLs pointing to private or internal networks are not allowed')
  }

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch (e) {
    // Can't fetch — return minimal info
    return {
      name: domain,
      price: null,
      priceValue: null,
      image: null,
      url,
      domain,
    }
  }

  const $ = cheerio.load(html)

  const jsonLd = extractFromJsonLd($)
  const og = extractFromOpenGraph($)
  const dom = extractFromDOM($)

  let name = jsonLd?.name || og?.name || dom?.name || $('title').text() || domain
  // Strip site name suffix from title
  if (name.includes(' | ') || name.includes(' - ')) {
    name = name.split(/\s*[|\-–—]\s*/)[0].trim()
  }

  return {
    name: cleanText(name),
    price: jsonLd?.price || og?.price || dom?.price || null,
    priceValue: jsonLd?.priceValue || og?.priceValue || dom?.priceValue || null,
    image: jsonLd?.image || og?.image || dom?.image || null,
    url,
    domain,
  }
}
