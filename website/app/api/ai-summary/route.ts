import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logApiCall, logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

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

  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const userName = session.user.name?.split(' ')[0] || 'there'
    const greeting = getGreeting()

    const [recentActivityCount, upcomingEvents, almostFunded, user] = await Promise.all([
      prisma.activityEvent.count({
        where: {
          createdAt: { gte: weekAgo },
          visibility: 'PUBLIC',
          userId: { not: userId },
        },
      }),
      prisma.event.findMany({
        where: { date: { gte: now, lte: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000) } },
        orderBy: { date: 'asc' },
        take: 3,
        select: { id: true, name: true, type: true, date: true },
      }),
      prisma.item.findMany({
        where: { userId, goalAmount: { not: null }, isPurchased: false },
        select: { name: true, goalAmount: true, fundedAmount: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { interests: true, relationship: true, gender: true },
      }),
    ])

    // Build context for Claude
    const eventsList = upcomingEvents.map((e) => {
      const days = Math.ceil((e.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return `${e.name} (${e.type}) in ${days} days`
    })

    const nearlyFunded = almostFunded
      .filter((i) => i.goalAmount && i.fundedAmount > 0 && (i.goalAmount - i.fundedAmount) <= 50)
      .map((i) => `${i.name} — $${(i.goalAmount! - i.fundedAmount).toFixed(0)} left`)

    let interests: string[] = []
    try {
      interests = user?.interests ? JSON.parse(user.interests) : []
    } catch {}

    const prompt = `Generate exactly 5-6 short sidebar summary cards for a gifting app. Each card is a JSON object with "emoji", "text", and optionally "action" and "href" fields. Return ONLY a JSON array, nothing else.

The "action" field should be included on actionable cards. The "href" field controls where the action links to:
- For cards about a specific upcoming date/occasion: use "href": "/events/new"
- For all other actionable cards (gift ideas, tips, trending, etc.): use "href": "/chat"
- If no "action" is set, omit "href" too

Context:
- User name: ${userName}
- Greeting: ${greeting}
- Today: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
- Friends active this week: ${recentActivityCount}
- User's personal events coming up: ${eventsList.length > 0 ? eventsList.join(', ') : 'none'}
- Almost-funded items: ${nearlyFunded.length > 0 ? nearlyFunded.join(', ') : 'none'}
- User interests: ${interests.length > 0 ? interests.join(', ') : 'unknown'}
- Household: ${user?.relationship || 'unknown'}

Rules:
- Card 1: ALWAYS a warm personal greeting mentioning the user's name and something relevant (friend activity, or a warm welcome). No action.
- Cards 2-6: MIX of different card types — do NOT make them all about dates. Include a diverse selection from these categories:
  * Upcoming event/holiday (max 1-2): the closest relevant date. action: "Create event", href: "/events/new"
  * Almost-funded items: if any items are close to being funded, highlight one. No action needed.
  * Gifting insight: a smart, personalized tip based on user interests (e.g. "Your friend who loves cooking might enjoy the new Le Creuset collection"). action: "Browse ideas", href: "/chat"
  * Trending/seasonal: what's hot in gifting right now, seasonal gift trends, or a product category suggestion. action: "See trending", href: "/chat"
  * Social: what friends are adding or wishlisting, group gifting nudges, or a fun gifting fact. No action needed.
- Maximum 2 cards about specific dates/occasions — the rest should be insights, tips, trends, or social updates
- Keep each card text to 1-2 short sentences max
- Use relevant emojis
- Be specific and personal, not generic
- Never mention the user should "check back" or "stay tuned"

Example output format:
[{"emoji":"👋","text":"Good morning, Alex! 3 friends added items this week."},{"emoji":"💝","text":"Valentine's Day is today — still time to find something special!","action":"Create event","href":"/events/new"},{"emoji":"🎁","text":"The Stanley Tumbler is almost funded — only $15 left."},{"emoji":"🔥","text":"Wellness gifts are trending this month — think journals, candles, and self-care kits.","action":"See trending","href":"/chat"},{"emoji":"💡","text":"Since you're into photography, a custom photo book makes an amazing last-minute gift.","action":"Browse ideas","href":"/chat"}]`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
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

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    console.log('[AI Summary] Raw Claude response:', rawText)

    // Extract JSON array from response (Claude sometimes wraps in markdown code blocks)
    let jsonText = rawText
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    let cards
    try {
      cards = JSON.parse(jsonText)
    } catch (e) {
      console.error('[AI Summary] JSON parse failed:', e, 'Raw:', rawText)
      // Fallback to basic cards if Claude returns bad JSON
      cards = [
        { emoji: '👋', text: `${greeting}, ${userName}!` },
      ]
    }
    console.log('[AI Summary] Parsed cards:', cards.length)

    return NextResponse.json({ cards, updatedAt: now.toISOString() })
  } catch (error) {
    console.error('AI summary error:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ cards: [], updatedAt: new Date().toISOString() })
  }
}
