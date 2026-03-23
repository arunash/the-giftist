import { NextRequest, NextResponse } from 'next/server'
import { logApiCall, logError } from '@/lib/api-logger'
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

RULES:
- Suggest 2-3 real, specific products with real prices and real retailer URLs.
- ALWAYS use [PRODUCT] blocks for each suggestion with "name", "price", and "url" fields.
- ALWAYS include a gift card option as a safe fallback (e.g., Amazon, Sephora, Target gift card with a specific denomination and real URL).
- Keep your text response to 1-2 short sentences max. Let the product cards do the talking.
- Be specific — real brands, real products, real URLs from real retailers (Amazon, Etsy, Uncommon Goods, Nordstrom, Target, etc.).
- Never suggest mugs, candles, or generic commodity items.
- Prefer specialty retailers: Uncommon Goods, Etsy shops, Bookshop.org, Food52, MasterClass, niche DTC brands.
- Amazon is OK for specific branded products (Kindle, AirPods, etc.) — never for generic filler.
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
      model: 'claude-haiku-4-5-20250929',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    }, { timeout: 15000 })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-haiku-4-5-20250929',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      source: 'LANDING',
    }).catch(() => {})

    return NextResponse.json({ text })
  } catch (error) {
    console.error('Quick chat error:', error)
    logError({ source: 'QUICK_CHAT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
