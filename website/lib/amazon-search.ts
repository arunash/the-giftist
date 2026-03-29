import { createHmac, createHash } from 'crypto'
import { RetailerResult } from './search-retailers'

const AMAZON_ACCESS_KEY = process.env.AMAZON_ACCESS_KEY
const AMAZON_SECRET_KEY = process.env.AMAZON_SECRET_KEY
const AMAZON_PARTNER_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || 'giftist05-20'

const HOST = 'webservices.amazon.com'
const REGION = 'us-east-1'
const SERVICE = 'ProductAdvertisingAPI'

// AWS Signature v4 helpers
function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

async function paapiRequest(operation: string, payload: Record<string, any>): Promise<any> {
  if (!AMAZON_ACCESS_KEY || !AMAZON_SECRET_KEY) return null

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const path = `/paapi5/${operation.toLowerCase()}`
  const body = JSON.stringify(payload)
  const bodyHash = sha256(body)

  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    'host': HOST,
    'x-amz-date': amzDate,
    'x-amz-target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
  }

  // Canonical request
  const signedHeaders = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('')
  const canonicalRequest = [
    'POST', path, '', canonicalHeaders, signedHeaders, bodyHash,
  ].join('\n')

  // String to sign
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest),
  ].join('\n')

  // Signature
  const signingKey = getSignatureKey(AMAZON_SECRET_KEY, dateStamp, REGION, SERVICE)
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${AMAZON_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`https://${HOST}${path}`, {
    method: 'POST',
    headers: { ...headers, Authorization: authorization },
    body,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`PA-API ${operation} ${response.status}: ${errText.slice(0, 200)}`)
  }

  return response.json()
}

function parseItem(item: any): RetailerResult | null {
  const price = item.Offers?.Listings?.[0]?.Price
  const availability = item.Offers?.Listings?.[0]?.Availability?.Type

  // Skip out-of-stock
  if (availability && availability !== 'Now') return null

  return {
    retailer: 'Amazon',
    url: item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}?tag=${AMAZON_PARTNER_TAG}`,
    title: item.ItemInfo?.Title?.DisplayValue || null,
    price: price?.DisplayAmount || null,
    priceValue: price?.Amount ? parseFloat(price.Amount) : null,
  }
}

/** Search Amazon PA-API for a product by keywords */
export async function searchAmazon(
  keywords: string,
  maxResults: number = 5,
): Promise<RetailerResult[]> {
  if (!AMAZON_ACCESS_KEY || !AMAZON_SECRET_KEY) {
    console.log('[AmazonSearch] No PA-API credentials configured')
    return []
  }

  try {
    const response = await paapiRequest('SearchItems', {
      Keywords: keywords,
      SearchIndex: 'All',
      ItemCount: Math.min(maxResults, 10),
      Condition: 'New',
      Availability: 'Available',
      PartnerTag: AMAZON_PARTNER_TAG,
      PartnerType: 'Associates',
      Resources: [
        'Images.Primary.Medium',
        'Images.Primary.Large',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Availability',
      ],
    })

    if (!response?.SearchResult?.Items) {
      console.log(`[AmazonSearch] No results for "${keywords}"`)
      return []
    }

    const results = response.SearchResult.Items
      .map(parseItem)
      .filter(Boolean) as RetailerResult[]

    console.log(`[AmazonSearch] PA-API found ${results.length} results for "${keywords}"`)
    return results
  } catch (error: any) {
    if (error?.message?.includes('TooManyRequests')) {
      console.log('[AmazonSearch] Rate limited — falling back to Perplexity')
    } else if (error?.message?.includes('InvalidPartnerTag') || error?.message?.includes('Unauthorized')) {
      console.log('[AmazonSearch] Auth error — check credentials:', error.message)
    } else {
      console.error('[AmazonSearch] PA-API error:', error.message || error)
    }
    return []
  }
}

/** Look up specific ASINs via PA-API */
export async function getAmazonItems(asins: string[]): Promise<RetailerResult[]> {
  if (!AMAZON_ACCESS_KEY || !AMAZON_SECRET_KEY) return []

  try {
    const response = await paapiRequest('GetItems', {
      ItemIds: asins.slice(0, 10),
      ItemIdType: 'ASIN',
      Condition: 'New',
      PartnerTag: AMAZON_PARTNER_TAG,
      PartnerType: 'Associates',
      Resources: [
        'Images.Primary.Medium',
        'Images.Primary.Large',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Availability',
      ],
    })

    if (!response?.ItemsResult?.Items) return []
    return response.ItemsResult.Items.map(parseItem).filter(Boolean) as RetailerResult[]
  } catch (error: any) {
    console.error('[AmazonSearch] GetItems error:', error.message || error)
    return []
  }
}

/** Check if PA-API is configured and available */
export function isAmazonApiConfigured(): boolean {
  return !!(AMAZON_ACCESS_KEY && AMAZON_SECRET_KEY)
}
