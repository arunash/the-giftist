import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logApiCall, logError } from '@/lib/api-logger'
import { extractProductFromUrl } from '@/lib/extract'
import OpenAI from 'openai'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI()
  return _client
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Build a simplified user profile for context
    const [user, recentItems] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { interests: true, ageRange: true, gender: true, giftBudget: true },
      }),
      prisma.item.findMany({
        where: { userId },
        orderBy: { addedAt: 'desc' },
        take: 10,
        select: { name: true, category: true, domain: true },
      }),
    ])

    const interests = user?.interests ? JSON.parse(user.interests) : []
    const recentNames = recentItems.map((i) => i.name).join(', ')
    const profileContext = [
      interests.length > 0 ? `Interests: ${interests.join(', ')}` : '',
      user?.ageRange ? `Age range: ${user.ageRange}` : '',
      user?.giftBudget ? `Budget: ${user.giftBudget}` : '',
      recentNames ? `Recent wishlist items: ${recentNames}` : '',
    ].filter(Boolean).join('\n')

    const response = await getClient().responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' as any }],
      input: `Find 8 trending products that would make great gifts or wishlist items. ${profileContext ? `User profile:\n${profileContext}\n\n` : ''}

Search the web for real, currently available products from major retailers (Amazon, Best Buy, Target, Nordstrom, Sephora, etc.). Include a diverse mix of categories.

For EACH product provide:
- name: concise product name (brand + model)
- price: formatted like "$XX.99"
- category: one word (Tech, Fashion, Home, Beauty, Fitness, Kitchen, Travel, Gaming, etc.)
- url: direct link to the product page on a major retailer website

Do NOT include image URLs — I will fetch images separately.

Return ONLY a JSON array, no other text:
[{"name":"...","price":"$XX","category":"...","url":"https://..."}]`,
    }, {
      timeout: 30000,
    })

    logApiCall({
      provider: 'OPENAI',
      endpoint: '/responses',
      model: 'gpt-4o',
      userId,
      source: 'WEB',
      metadata: { usage: (response as any).usage },
    }).catch(() => {})

    const text = response.output
      .filter((item): item is OpenAI.Responses.ResponseOutputMessage => item.type === 'message')
      .flatMap((item) => item.content)
      .filter((block): block is OpenAI.Responses.ResponseOutputText => block.type === 'output_text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json([])
    }

    const rawItems = JSON.parse(jsonMatch[0])
      .filter((item: any) => item.name && item.url && !item.url.includes('google.com/search'))
      .map((item: any) => ({
        name: item.name,
        price: item.price || '',
        category: item.category || 'Other',
        image: '',
        url: item.url,
      }))

    // Scrape real product images and prices from retailer URLs (parallel)
    const enriched = await Promise.all(
      rawItems.map(async (item: any) => {
        try {
          const scraped = await extractProductFromUrl(item.url)
          return {
            ...item,
            image: scraped.image || '',
            price: scraped.price || item.price,
          }
        } catch {
          return item
        }
      })
    )

    return NextResponse.json(enriched.filter((item: any) => item.image))
  } catch (error) {
    console.error('Error fetching trending:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json([])
  }
}
