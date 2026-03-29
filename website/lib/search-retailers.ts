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

let _openaiClient: OpenAI | null = null
function getOpenAI() {
  if (!_openaiClient) _openaiClient = new OpenAI()
  return _openaiClient
}

let _perplexityClient: OpenAI | null = null
function getPerplexity(): OpenAI | null {
  if (!process.env.PERPLEXITY_API_KEY) return null
  if (!_perplexityClient) {
    _perplexityClient = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    })
  }
  return _perplexityClient
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

function parseAndValidateResults(text: string, productName: string): RetailerResult[] {
  // Match JSON arrays starting with [{ — avoids matching markdown links like [text](url)
  const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (!jsonMatch) {
    console.log(`[RetailerSearch] No JSON array found for "${productName}". Raw text: ${text.slice(0, 200)}`)
    return []
  }

  let parsed: RetailerResult[]
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    console.log(`[RetailerSearch] JSON parse failed for "${productName}". Matched: ${jsonMatch[0].slice(0, 200)}`)
    return []
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return []

  return parsed
    .filter((r) => r.url && r.retailer)
    .map((r) => ({
      retailer: r.retailer,
      url: r.url,
      title: r.title || null,
      price: r.price || null,
      priceValue: typeof r.priceValue === 'number' ? r.priceValue : null,
    }))
    .filter((r) => {
      if (r.title && !titleMatchesProduct(r.title, productName)) {
        console.log(`[RetailerSearch] Title mismatch: searched "${productName}", got "${r.title}" — skipping ${r.url}`)
        return false
      }
      return true
    })
}

const RETAILER_SEARCH_PROMPT = (searchQuery: string, descriptionHint: string) => `Find this SPECIFIC product for sale online: "${searchQuery}"${descriptionHint}

CRITICAL RULES:
1. Find the EXACT product — not a similar or related product. Verify each URL leads to "${searchQuery}" specifically.
2. Product MUST be IN STOCK and available to buy right now. Do NOT include out-of-stock, discontinued, or "currently unavailable" products.
3. URL must go to a direct product page, not a search results page.

Search Amazon, Target, Walmart, and Best Buy. For Amazon, the URL MUST be in amazon.com/dp/ASIN format.

For EACH result, you MUST include the "title" field — the exact product title as shown on the retailer's page. This is used to verify you found the right product.

IMPORTANT: Return ONLY a raw JSON array with NO other text, NO markdown, NO explanation. Just the array:
[{"retailer":"Amazon","url":"https://www.amazon.com/dp/B0XXXXXXXXX","title":"Ember Temperature Control Smart Mug 2, 14 oz, Black","price":"$149.95","priceValue":149.95}]

Fields:
- retailer: store name
- url: direct product page URL (Amazon MUST be amazon.com/dp/ASIN)
- title: EXACT product title from the page (REQUIRED)
- price: formatted price like "$29.99" (or null)
- priceValue: numeric price (or null)

If you cannot find the EXACT product IN STOCK at a retailer, omit that retailer. If you cannot find it anywhere in stock, return [].`

/** Search using Perplexity Sonar (better at returning real URLs with citations) */
async function searchWithPerplexity(
  productName: string,
  searchQuery: string,
  descriptionHint: string,
): Promise<RetailerResult[]> {
  const client = getPerplexity()
  if (!client) return []

  try {
    const response = await client.chat.completions.create({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'You are a product search assistant. Return only raw JSON arrays, no markdown or explanation.' },
        { role: 'user', content: RETAILER_SEARCH_PROMPT(searchQuery, descriptionHint) },
      ],
    })

    const text = response.choices[0]?.message?.content || ''
    logApiCall({
      provider: 'PERPLEXITY',
      endpoint: '/chat/completions',
      model: 'sonar',
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      source: 'WEB',
    }).catch(() => {})

    const results = parseAndValidateResults(text, productName)
    if (results.length > 0) {
      console.log(`[RetailerSearch] Perplexity found ${results.length} results for "${productName}"`)
    }
    return results
  } catch (error) {
    console.log(`[RetailerSearch] Perplexity search failed for "${productName}":`, error)
    return []
  }
}

/** Search using GPT-4o with web search (fallback) */
async function searchWithGPT4o(
  productName: string,
  searchQuery: string,
  descriptionHint: string,
): Promise<RetailerResult[]> {
  const response = await getOpenAI().responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' as any }],
    input: RETAILER_SEARCH_PROMPT(searchQuery, descriptionHint),
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

  const text = response.output
    .filter((item): item is OpenAI.Responses.ResponseOutputMessage => item.type === 'message')
    .flatMap((item) => item.content)
    .filter((block): block is OpenAI.Responses.ResponseOutputText => block.type === 'output_text')
    .map((block) => block.text)
    .join('')

  const results = parseAndValidateResults(text, productName)
  if (results.length > 0) {
    console.log(`[RetailerSearch] GPT-4o found ${results.length} results for "${productName}"`)
  }
  return results
}

export async function searchRetailers(
  productName: string,
  brand: string | null,
  description: string | null,
): Promise<RetailerSearchResult> {
  const searchQuery = [brand, productName].filter(Boolean).join(' ')
  const descriptionHint = description ? `\nProduct description: ${description}` : ''

  try {
    // Try Perplexity first (better at returning real product URLs), fall back to GPT-4o
    let results = await searchWithPerplexity(productName, searchQuery, descriptionHint)
    if (results.length === 0) {
      results = await searchWithGPT4o(productName, searchQuery, descriptionHint)
    }

    if (results.length === 0) return { results: [], bestResult: null }

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
