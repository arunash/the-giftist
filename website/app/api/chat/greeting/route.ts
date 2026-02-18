import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logApiCall, logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// Cache greeting per user for 15 minutes
const greetingCache = new Map<string, { data: any; expiresAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id

  const cached = greetingCache.get(userId)
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data)
  }

  try {
    const now = new Date()
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const [user, itemCount, events] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          birthday: true,
          interests: true,
          giftBudget: true,
          relationship: true,
          createdAt: true,
        },
      }),
      prisma.item.count({ where: { userId } }),
      prisma.event.findMany({
        where: { userId, date: { gte: now, lte: twoWeeksOut } },
        orderBy: { date: 'asc' },
        take: 5,
        select: { name: true, type: true, date: true },
      }),
    ])

    if (!user) {
      return NextResponse.json({ greeting: null, suggestion: null })
    }

    const firstName = user.name?.split(' ')[0] || 'there'
    const greeting = getGreeting()
    const hasInterests = user.interests && JSON.parse(user.interests || '[]').length > 0
    const hasEvents = events.length > 0
    const hasBudget = !!user.giftBudget
    const hasBirthday = !!user.birthday
    const isNew = itemCount === 0
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Build a context string for Claude to generate a proactive greeting
    const profileGaps: string[] = []
    if (!hasBirthday) profileGaps.push('birthday')
    if (!hasEvents) profileGaps.push('upcoming events/important dates (birthdays of loved ones, anniversaries, holidays)')
    if (!hasInterests) profileGaps.push('interests/hobbies')
    if (!hasBudget) profileGaps.push('gift budget')

    const upcomingEvents = events
      .filter((e) => new Date(e.date) >= new Date())
      .map((e) => {
        const days = Math.ceil(
          (new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return `${e.name} (${e.type}) in ${days} days`
      })

    let interests: string[] = []
    try {
      interests = user.interests ? JSON.parse(user.interests) : []
    } catch {}

    const prompt = `Generate a JSON object with two fields: "greeting" and "suggestion". Return ONLY the JSON object, nothing else.

The "greeting" is a short, warm, proactive greeting (1-2 sentences) from the Giftist Gift Concierge. The tone should be like a friendly personal shopper checking in.

The "suggestion" is a specific, actionable gift recommendation tied to an upcoming event or user interest. It should name a specific product with a price point. If there's an upcoming event, tie the suggestion to it. If not, base it on the user's interests. If neither, suggest a trending/seasonal gift idea.

User context:
- Name: ${firstName}
- Time greeting: ${greeting}
- Account age: ${accountAgeDays} days
- Items on wishlist: ${itemCount}
- Has upcoming events: ${hasEvents}${upcomingEvents.length > 0 ? ` (${upcomingEvents.join(', ')})` : ''}
- User interests: ${interests.length > 0 ? interests.join(', ') : 'unknown'}
- Profile gaps (things we don't know yet): ${profileGaps.length > 0 ? profileGaps.join(', ') : 'profile is complete'}
- Is brand new user: ${isNew}

Rules for greeting:
- If they're missing important dates, ask about upcoming events
- If they have an upcoming event, reference it
- If they're new, welcome them warmly
- Do NOT use emojis
- Keep it conversational, 1-2 sentences max

Rules for suggestion:
- MUST be specific: name a real product/experience and approximate price (e.g. "A Le Creuset Dutch Oven (~$95) would match her love of cooking")
- If there's an upcoming event within 14 days, tie the suggestion to it (e.g. "Sarah's birthday is in 5 days. A Kindle Paperwhite (~$140) would be perfect for the book lover in your life.")
- If no upcoming event, base it on user interests
- If no interests known, suggest something seasonally relevant or universally loved
- Keep it to 1-2 sentences
- Do NOT use emojis

Example output:
{"greeting":"Good morning, Alex! You've been building a great list this week.","suggestion":"Mom's birthday is in 8 days. A Le Creuset Dutch Oven (~$95) would be a perfect match for her love of cooking."}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      userId,
      source: 'WEB',
    }).catch(() => {})

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text.trim() : null

    if (!rawText) {
      return NextResponse.json({ greeting: null, suggestion: null })
    }

    // Parse structured JSON response
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const data = {
          greeting: parsed.greeting || null,
          suggestion: parsed.suggestion || null,
        }
        greetingCache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS })
        return NextResponse.json(data)
      }
    } catch {}

    // Fallback: treat entire response as greeting text
    const fallback = { greeting: rawText, suggestion: null }
    greetingCache.set(userId, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(fallback)
  } catch (error) {
    console.error('Greeting generation error:', error)
    logError({ source: 'CHAT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ greeting: null, suggestion: null })
  }
}
