import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logApiCall, logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// Cache AI summary per user for 10 minutes to avoid redundant API calls
const summaryCache = new Map<string, { data: any; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000

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

  // Return cached response if fresh
  const cached = summaryCache.get(userId)
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data)
  }

  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const userName = session.user.name?.split(' ')[0] || 'there'
    const greeting = getGreeting()

    const [recentActivity, upcomingEvents, almostFunded, user, totalItems] = await Promise.all([
      prisma.activityEvent.findMany({
        where: {
          createdAt: { gte: weekAgo },
          userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { type: true, metadata: true, createdAt: true },
      }),
      prisma.event.findMany({
        where: { userId, date: { gte: now, lte: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000) } },
        orderBy: { date: 'asc' },
        take: 5,
        include: {
          items: {
            include: { item: { select: { name: true, fundedAmount: true, goalAmount: true, isPurchased: true } } },
            take: 5,
          },
        },
      }),
      prisma.item.findMany({
        where: { userId, goalAmount: { not: null }, isPurchased: false },
        select: { name: true, goalAmount: true, fundedAmount: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { interests: true, relationship: true, gender: true },
      }),
      prisma.item.count({ where: { userId } }),
    ])
    const recentActivityCount = recentActivity.length

    // Build context for Claude
    const eventsList = upcomingEvents.map((e) => {
      const days = Math.ceil((e.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const itemCount = e.items.length
      const fundedItems = e.items.filter((ei: any) => ei.item.fundedAmount > 0).length
      const purchasedItems = e.items.filter((ei: any) => ei.item.isPurchased).length
      const itemNames = e.items.slice(0, 3).map((ei: any) => ei.item.name).join(', ')
      return `${e.name} (${e.type}) in ${days} days — ${itemCount} items${itemCount > 0 ? ` (${fundedItems} funded, ${purchasedItems} purchased): ${itemNames}` : ', no items yet'}`
    })

    const nearlyFunded = almostFunded
      .filter((i) => i.goalAmount && i.fundedAmount > 0 && (i.goalAmount - i.fundedAmount) <= 50)
      .map((i) => `${i.name} — $${(i.goalAmount! - i.fundedAmount).toFixed(0)} left`)

    // Summarize recent activity
    const activitySummary: string[] = []
    const activityCounts: Record<string, number> = {}
    for (const a of recentActivity) {
      activityCounts[a.type] = (activityCounts[a.type] || 0) + 1
      if (activitySummary.length < 5) {
        let meta: Record<string, any> = {}
        try { meta = a.metadata ? JSON.parse(a.metadata as string) : {} } catch {}
        const itemName = meta.itemName || meta.eventName || ''
        if (itemName) activitySummary.push(`${a.type}: ${itemName}`)
      }
    }

    // Events with no items (gift ideas needed)
    const emptyEvents = upcomingEvents
      .filter((e) => e.items.length === 0)
      .map((e) => {
        const days = Math.ceil((e.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return `${e.name} in ${days} days`
      })

    let interests: string[] = []
    try {
      interests = user?.interests ? JSON.parse(user.interests) : []
    } catch {}

    const prompt = `Generate exactly 5-6 short sidebar summary cards for a gifting app. Each card is a JSON object with "emoji", "text", "action", and "href" fields. Return ONLY a JSON array, nothing else.

IMPORTANT: Every card EXCEPT the first greeting card MUST have "action" and "href". Actions must be verb-first and specific. The "href" should be a /chat?q= deep link with a specific question or request, or /events/new for event creation.

Context:
- User name: ${userName}
- Greeting: ${greeting}
- Today: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
- Total items on wishlist: ${totalItems}
- User's personal events coming up: ${eventsList.length > 0 ? eventsList.join('\n  ') : 'none'}
- Events that need gift ideas (no items yet): ${emptyEvents.length > 0 ? emptyEvents.join(', ') : 'none'}
- Almost-funded items: ${nearlyFunded.length > 0 ? nearlyFunded.join(', ') : 'none'}
- Recent activity this week (${recentActivityCount} total): ${activitySummary.length > 0 ? activitySummary.join(', ') : 'no activity yet'}
- Activity breakdown: ${Object.entries(activityCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'}
- User interests: ${interests.length > 0 ? interests.join(', ') : 'unknown'}
- Household: ${user?.relationship || 'unknown'}

Rules:
- Card 1: ALWAYS a warm personal greeting mentioning the user's name and something relevant (recent activity, or a warm welcome). No action or href on this card only.
- Cards 2-6: EVERY card MUST have "action" and "href". MIX of different card types — do NOT make them all about dates. Include a diverse selection from these categories:
  * Upcoming event insight (max 1-2): mention the closest event, how many items are linked. action: verb-first CTA like "Find gifts for Mom", href: "/chat?q=Help me find gift ideas for <event name>"
  * Event prep nudge: if an event has no items yet and is coming up soon. action: "Plan <event> gifts", href: "/chat?q=Help me find gifts for <event name>"
  * Almost-funded items: highlight one that's close to being funded. action: "Share to finish funding", href: "/chat?q=Help me share <item name> to get it fully funded"
  * List curation: if the user has many items, suggest curating. action: "Curate top 10", href: "/chat?q=Help me pick my top 10 items"
  * Activity insight: reference recent activity and suggest a next step. action: verb-first CTA, href: "/chat?q=<relevant follow-up>"
  * Gifting insight: personalized tip based on user interests. action: "Explore <category>", href: "/chat?q=Show me <category> gift ideas"
  * Trending/seasonal: what's hot in gifting right now. action: "See what's trending", href: "/chat?q=What gifts are trending right now"
- Maximum 2 cards about specific dates/occasions — the rest should be insights, activity recaps, and tips
- Keep each card text to 1-2 short sentences max
- Use relevant emojis
- Be specific and personal, not generic
- Never mention the user should "check back" or "stay tuned"
- Action text should be 2-4 words, verb-first (e.g. "Find gifts for Mom", "Curate top 10", "Explore cooking gear")

Example output format:
[{"emoji":"👋","text":"Good morning, Alex! 3 friends added items this week."},{"emoji":"💝","text":"Valentine's Day is in 5 days — you have 2 items linked but no gifts for Sarah yet.","action":"Find gifts for Sarah","href":"/chat?q=Help me find Valentine's Day gifts for Sarah"},{"emoji":"🎁","text":"The Stanley Tumbler is almost funded — only $15 left.","action":"Share to finish funding","href":"/chat?q=Help me share my Stanley Tumbler to get it fully funded"},{"emoji":"🔥","text":"Wellness gifts are trending this month — journals, candles, and self-care kits.","action":"See what's trending","href":"/chat?q=What wellness gifts are trending right now"},{"emoji":"💡","text":"Since you love photography, a custom photo book makes an amazing gift.","action":"Explore photo gifts","href":"/chat?q=Show me photography themed gift ideas"}]`

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

    const result = { cards, updatedAt: now.toISOString() }
    summaryCache.set(userId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI summary error:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ cards: [], updatedAt: new Date().toISOString() })
  }
}
