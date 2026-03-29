import OpenAI from 'openai'
import { logApiCall, logError } from '@/lib/api-logger'

export interface RetailerResult {
  retailer: string
  url: string
  title: string | null  // product title from the actual page
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

/** Check if a product title roughly matches what we searched for */
function titleMatchesProduct(title: string, searchName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  const titleNorm = normalize(title)
  const searchNorm = normalize(searchName)

  // Extract key words from search (2+ chars, skip common words)
  const skipWords = new Set(['the', 'and', 'for', 'with', 'from', 'by', 'in', 'of', 'oz', 'inch'])
  const searchWords = searchNorm.split(' ').filter(w => w.length >= 2 && !skipWords.has(w))

  // At least half of the key search words should appear in the title
  const matches = searchWords.filter(w => titleNorm.includes(w))
  const matchRatio = searchWords.length > 0 ? matches.length / searchWords.length : 0

  return matchRatio >= 0.5
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
      input: `Find this SPECIFIC product for sale online: "${searchQuery}"${descriptionHint}

CRITICAL: You must find the EXACT product — not a similar or related product. Verify each URL leads to "${searchQuery}" specifically.

Search Amazon first (amazon.com/dp/ASIN format), then also check Target, Walmart, Best Buy.

For EACH result, you MUST include the "title" field — the exact product title as shown on the retailer's page. This is used to verify you found the right product.

Return ONLY a JSON array:
[{"retailer":"Amazon","url":"https://www.amazon.com/dp/B0XXXXXXXXX","title":"Ember Temperature Control Smart Mug 2, 14 oz, Black","price":"$149.95","priceValue":149.95}]

Fields:
- retailer: store name
- url: direct product page URL (Amazon MUST be amazon.com/dp/ASIN)
- title: EXACT product title from the page (REQUIRED)
- price: formatted price like "$29.99" (or null)
- priceValue: numeric price (or null)

If you cannot find the EXACT product, return []. Do NOT return a different product.`,
    }, {
      timeout: 30000,
    })

    const usage = (response as any).usage
    logApiCall({
      provider: 'OPENAI',
      endpoint: '/responses',
      model: 'gpt-4o',
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      source: 'WEB',
    }).catch(() => {})

    // Extract text from output items
    const text = response.output
      .filter((item): item is OpenAI.Responses.ResponseOutputMessage => item.type === 'message')
      .flatMap((item) => item.content)
      .filter((block): block is OpenAI.Responses.ResponseOutputText => block.type === 'output_text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log(`[RetailerSearch] No JSON array found in response for "${productName}". Raw text: ${text.slice(0, 200)}`)
      return { results: [], bestResult: null }
    }

    let parsed: RetailerResult[]
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      console.log(`[RetailerSearch] JSON parse failed for "${productName}". Matched: ${jsonMatch[0].slice(0, 200)}`)
      return { results: [], bestResult: null }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return { results: [], bestResult: null }

    // Validate, clean, and verify title matches
    const results = parsed
      .filter((r) => r.url && r.retailer)
      .map((r) => ({
        retailer: r.retailer,
        url: r.url,
        title: r.title || null,
        price: r.price || null,
        priceValue: typeof r.priceValue === 'number' ? r.priceValue : null,
      }))
      .filter((r) => {
        // Reject results where the title clearly doesn't match what we searched for
        if (r.title && !titleMatchesProduct(r.title, productName)) {
          console.log(`[RetailerSearch] Title mismatch: searched "${productName}", got "${r.title}" — skipping ${r.url}`)
          return false
        }
        return true
      })

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
