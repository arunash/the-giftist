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

/** Try to extract URLs from markdown-formatted text when JSON parsing fails */
function extractFromMarkdown(text: string, productName: string): RetailerResult[] {
  const results: RetailerResult[] = []
  // Match markdown links: [text](url) or plain URLs
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(?:^|\s)(https?:\/\/(?:www\.)?(?:amazon|walmart|target|bestbuy)\.[^\s]+)/gmi
  let match
  while ((match = linkRegex.exec(text)) !== null) {
    const label = match[1] || ''
    const url = (match[2] || match[3] || '').replace(/[).,;]+$/, '')
    if (!url) continue

    let retailer = ''
    if (url.includes('amazon.')) retailer = 'Amazon'
    else if (url.includes('walmart.')) retailer = 'Walmart'
    else if (url.includes('target.')) retailer = 'Target'
    else if (url.includes('bestbuy.')) retailer = 'Best Buy'
    else continue

    // Extract price from surrounding text
    const priceMatch = text.slice(Math.max(0, (match.index || 0) - 50), (match.index || 0) + match[0].length + 50).match(/\$(\d+(?:\.\d{2})?)/)
    const priceValue = priceMatch ? parseFloat(priceMatch[1]) : null

    results.push({
      retailer,
      url,
      title: label || null,
      price: priceValue ? `$${priceValue.toFixed(2)}` : null,
      priceValue,
    })
  }

  return results.filter(r => {
    if (r.title && !titleMatchesProduct(r.title, productName)) return false
    return true
  })
}

function parseAndValidateResults(text: string, productName: string): RetailerResult[] {
  // Match JSON arrays starting with [{ — avoids matching markdown links like [text](url)
  const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (!jsonMatch) {
    console.log(`[RetailerSearch] No JSON array found for "${productName}". Trying markdown extraction. Raw: ${text.slice(0, 200)}`)
    return extractFromMarkdown(text, productName)
  }

  let parsed: RetailerResult[]
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    console.log(`[RetailerSearch] JSON parse failed for "${productName}". Trying markdown extraction. Matched: ${jsonMatch[0].slice(0, 200)}`)
    return extractFromMarkdown(text, productName)
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

PRIORITY ORDER: Search Amazon FIRST, then Target, Walmart, and Best Buy. Amazon is the most important — always include an Amazon result if the product exists there.

For Amazon, the URL MUST be in https://www.amazon.com/dp/ASIN format (10-character alphanumeric ASIN). Example: https://www.amazon.com/dp/B0C9S7Y9FN

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

const AMAZON_SEARCH_PROMPT = (searchQuery: string) => `Find this SPECIFIC product on Amazon.com: "${searchQuery}"

I need the EXACT Amazon product page URL in this format: https://www.amazon.com/dp/ASIN
The ASIN is a 10-character alphanumeric code (e.g., B0C9S7Y9FN).

The product MUST be in stock and available for purchase right now.

Return ONLY a raw JSON array with NO other text:
[{"retailer":"Amazon","url":"https://www.amazon.com/dp/B0XXXXXXXXX","title":"exact product title from the page","price":"$XX.XX","priceValue":XX.XX}]

If you cannot find the exact product on Amazon, return [].`

/** Search using Perplexity Sonar (better at returning real URLs with citations) */
async function searchWithPerplexity(
  productName: string,
  prompt: string,
  label: string = 'general',
): Promise<RetailerResult[]> {
  const client = getPerplexity()
  if (!client) return []

  try {
    const response = await client.chat.completions.create({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'You are a product search assistant. Return only raw JSON arrays, no markdown or explanation.' },
        { role: 'user', content: prompt },
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
      console.log(`[RetailerSearch] Perplexity (${label}) found ${results.length} results for "${productName}"`)
    }
    return results
  } catch (error) {
    console.log(`[RetailerSearch] Perplexity (${label}) search failed for "${productName}":`, error)
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
    let results = await searchWithPerplexity(
      productName,
      RETAILER_SEARCH_PROMPT(searchQuery, descriptionHint),
      'general',
    )
    if (results.length === 0) {
      results = await searchWithGPT4o(productName, searchQuery, descriptionHint)
    }

    // If no Amazon result found, do a targeted Amazon-only search via Perplexity
    const hasAmazon = results.some(r => r.url.includes('amazon.com/dp/'))
    if (!hasAmazon) {
      console.log(`[RetailerSearch] No Amazon result — running targeted Amazon search for "${productName}"`)
      const amazonResults = await searchWithPerplexity(
        productName,
        AMAZON_SEARCH_PROMPT(searchQuery),
        'amazon',
      )
      if (amazonResults.length > 0) {
        // Prepend Amazon results
        results = [...amazonResults.filter(r => r.url.includes('amazon.com')), ...results]
      }
    }

    if (results.length === 0) return { results: [], bestResult: null }

    // Pick lowest price as best result
    const withPrice = results.filter((r) => r.priceValue !== null && r.priceValue > 0)
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
