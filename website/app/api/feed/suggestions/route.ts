import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logApiCall, logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// Simple in-memory cache
let cache: { data: any; timestamp: number; userId: string } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Check cache
    if (cache && cache.userId === userId && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    // Get user's recent items for context
    const items = await prisma.item.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      take: 20,
      select: { name: true, category: true, priceValue: true, domain: true },
    })

    if (items.length < 3) {
      return NextResponse.json({ suggestions: [] })
    }

    const itemList = items.map((i) => `- ${i.name} (${i.category || 'uncategorized'}, ${i.priceValue ? '$' + i.priceValue : 'no price'})`).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Based on these wishlist items, suggest 3 gift ideas the user might like. Items:\n${itemList}\n\nReturn ONLY a JSON array of objects with fields: "title" (short), "description" (1 sentence why they'd like it), "category" (string). No markdown, just JSON.`,
        },
      ],
    })

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      userId,
      source: 'WEB',
    }).catch(() => {})

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    let suggestions = []
    try {
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    } catch {
      suggestions = []
    }

    const result = { suggestions }
    cache = { data: result, timestamp: Date.now(), userId }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ suggestions: [] })
  }
}
