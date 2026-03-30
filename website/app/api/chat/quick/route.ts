import { NextRequest, NextResponse } from 'next/server'
import { logApiCall, logError } from '@/lib/api-logger'
import { parseChatContent, type ProductData } from '@/lib/parse-chat-content'
import { applyAffiliateTag } from '@/lib/affiliate'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// IP-based rate limiting: 5 requests per IP per hour
const ipRateMap = new Map<string, { count: number; resetAt: number }>()
const IP_RATE_LIMIT = 5
const IP_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkIpRate(ip: string): boolean {
  const now = Date.now()
  const entry = ipRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + IP_RATE_WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= IP_RATE_LIMIT
}

const SYSTEM_PROMPT = `You are the Giftist Gift Concierge — an opinionated personal shopper who's also a close friend. Confident, tasteful, decisive.

You are responding to an anonymous visitor on the landing page. Your goal is to give them amazing gift recommendations so they sign up.

PREFERRED RETAILERS (ALWAYS use these — we earn affiliate commission):
- Amazon (amazon.com) — electronics, books, household, branded products
- Etsy (etsy.com) — handmade, personalized, unique gifts
- Uncommon Goods (uncommongoods.com) — curated, creative gifts
- Target (target.com) — home, kitchen, beauty
- Walmart (walmart.com) — value/budget options
- Nordstrom (nordstrom.com) — fashion, luxury accessories
- Bookshop.org — books
- Food52 (food52.com) — kitchen/cooking gifts
- MasterClass (masterclass.com) — experience/learning gifts
- Cratejoy (cratejoy.com) — subscription box gifts
NEVER link to retailers outside this list.

RULES:
- Suggest 2-3 real, specific products with real prices and real retailer URLs from the preferred list above.
- ALWAYS use [PRODUCT] blocks for each suggestion with "name", "price", and "url" fields.
- ALWAYS include a gift card option as a safe fallback (Amazon, Sephora, Target gift card with specific denomination and URL).
- Keep your text response to 1-2 short sentences max. Let the product cards do the talking.
- Be specific — real brands, real products. Use real product page URLs (e.g., amazon.com/dp/B00NK3FHQW), NOT search pages.
- Never suggest mugs, candles, or generic commodity items.
- Suggest across price tiers when possible.
- Do NOT use any structured blocks except [PRODUCT].
- Do NOT ask follow-up questions — just give your best recommendations immediately.

PRODUCT FORMAT:
[PRODUCT]{"name":"Product Name","price":"$XX.XX","url":"https://retailer.com/product"}[/PRODUCT]

Example:
Here are some great picks for a cooking enthusiast:

[PRODUCT]{"name":"Le Creuset Signature Dutch Oven","price":"$350","url":"https://www.amazon.com/dp/B00NK3FHQW"}[/PRODUCT]
[PRODUCT]{"name":"Uncommon Goods Personalized Cutting Board","price":"$60","url":"https://www.uncommongoods.com/product/personalized-state-cutting-board"}[/PRODUCT]
[PRODUCT]{"name":"Amazon Gift Card","price":"$50","url":"https://www.amazon.com/dp/B004LLIKVU"}[/PRODUCT]`

// Validate a URL by checking if it resolves (HEAD request)
async function validateUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    if (parsed.hostname.includes('google.com')) return false

    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok || res.status === 405 // some sites block HEAD but return 405
  } catch {
    return false
  }
}

// Resolve product URLs: validate AI's URL, fallback to Amazon search (no expensive GPT-4o searches for anonymous users)
async function resolveProductUrl(product: ProductData): Promise<string | null> {
  // If AI provided a URL, validate it
  if (product.url && !product.url.includes('google.com/search')) {
    const valid = await validateUrl(product.url)
    if (valid) return applyAffiliateTag(product.url)
  }

  // For anonymous landing page: cheap Amazon search link instead of GPT-4o web search
  const affiliateTag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || 'giftist05-20'
  return `https://www.amazon.com/s?k=${encodeURIComponent(product.name)}&tag=${affiliateTag}`
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    if (!checkIpRate(ip)) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { message } = await request.json()
    if (!message || typeof message !== 'string' || message.length > 500) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    }, { timeout: 15000 })

    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      source: 'LANDING',
    }).catch(() => {})

    // Parse products and resolve URLs server-side
    const segments = parseChatContent(rawText)
    const products = segments
      .filter((s): s is { type: 'product'; data: ProductData } => s.type === 'product')
      .map(s => s.data)

    // Resolve all product URLs in parallel (validate + fallback search)
    const resolvedProducts = await Promise.all(
      products.map(async (product) => {
        const resolvedUrl = await resolveProductUrl(product)
        return { ...product, url: resolvedUrl || undefined }
      })
    )

    // Rebuild the response text with resolved URLs
    const textSegments = segments
      .filter(s => s.type === 'text')
      .map(s => s.type === 'text' ? s.content : '')

    return NextResponse.json({
      text: textSegments.join(' ').trim(),
      products: resolvedProducts,
    })
  } catch (error) {
    console.error('Quick chat error:', error)
    logError({ source: 'QUICK_CHAT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
