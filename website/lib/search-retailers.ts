import OpenAI from 'openai'
import { logApiCall, logError } from '@/lib/api-logger'

export interface RetailerResult {
  retailer: string
  url: string
  price: string | null
  priceValue: number | null
}

export interface RetailerSearchResult {
  results: RetailerResult[]
  bestResult: RetailerResult | null
}

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI()
  return _client
}

export async function searchRetailers(
  productName: string,
  brand: string | null,
  description: string | null,
): Promise<RetailerSearchResult> {
  const searchQuery = [brand, productName].filter(Boolean).join(' ')
  const descriptionHint = description ? `\nProduct description: ${description}` : ''

  try {
    const response = await getClient().responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' as any }],
      input: `Find this product for sale online: "${searchQuery}"${descriptionHint}

Search for it at major US retailers (Amazon, Target, Walmart, Best Buy, etc.) and find the best price.

Return ONLY a JSON array of results you found, each with:
- retailer: store name (e.g. "Amazon")
- url: direct product page URL
- price: formatted price like "$29.99" (or null if not found)
- priceValue: numeric price like 29.99 (or null)

Example: [{"retailer":"Amazon","url":"https://amazon.com/dp/...","price":"$29.99","priceValue":29.99}]

If you cannot find the product at any retailer, return an empty array: []`,
    }, {
      timeout: 30000,
    })

    logApiCall({
      provider: 'OPENAI',
      endpoint: '/responses',
      model: 'gpt-4o',
      source: 'WEB',
      metadata: { usage: (response as any).usage, searchQuery },
    }).catch(() => {})

    // Extract text from output items
    const text = response.output
      .filter((item): item is OpenAI.Responses.ResponseOutputMessage => item.type === 'message')
      .flatMap((item) => item.content)
      .filter((block): block is OpenAI.Responses.ResponseOutputText => block.type === 'output_text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return { results: [], bestResult: null }

    const parsed: RetailerResult[] = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed) || parsed.length === 0) return { results: [], bestResult: null }

    // Validate and clean results
    const results = parsed
      .filter((r) => r.url && r.retailer)
      .map((r) => ({
        retailer: r.retailer,
        url: r.url,
        price: r.price || null,
        priceValue: typeof r.priceValue === 'number' ? r.priceValue : null,
      }))

    // Pick lowest price as best result
    const withPrice = results.filter((r) => r.priceValue !== null)
    const bestResult = withPrice.length > 0
      ? withPrice.reduce((best, r) => (r.priceValue! < best.priceValue! ? r : best))
      : results[0] || null

    return { results, bestResult }
  } catch (error) {
    console.error('Retailer search error:', error)
    logError({ source: 'EXTRACT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return { results: [], bestResult: null }
  }
}
