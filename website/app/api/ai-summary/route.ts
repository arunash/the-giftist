import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
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

    const prompt = `Generate exactly 5-6 short sidebar summary cards for a gifting app. Each card is a JSON object with "emoji", "text", and optionally "action" fields. Return ONLY a JSON array, nothing else.

The "action" field should be included on any card that suggests a gifting opportunity — it contains a short button label like "Find gifts", "Build a list", "Browse ideas", "Start gifting", etc. Only the greeting card and pure info cards should omit "action".

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
- Card 1: ALWAYS a warm personal greeting mentioning the user's name and something relevant (friend activity, or a warm welcome). No action button.
- Cards 2-4: Pick from upcoming personal events, almost-funded items, upcoming holidays/cultural gifting moments (Valentine's Day, Mother's Day, Father's Day, Diwali, Christmas, Hanukkah, Lunar New Year, Eid, graduation season, Teacher Appreciation, etc.) — whichever are closest to today's date. Include "action" on these.
- Cards 5-6: Proactive gifting tips, seasonal reminders, or lesser-known gifting occasions coming in the next 2-3 months (e.g. wedding season, back-to-school, National Sibling Day, Boss's Day, Galentine's Day, etc.). Include "action" on these.
- ALWAYS generate at least 5 cards, ideally 6
- Keep each card text to 1-2 short sentences max
- Use relevant emojis (🎂 birthdays, 🎁 gifts, 💝 Valentine's, 🎄 Christmas, 🪔 Diwali, etc.)
- Be specific about dates: "today", "in 3 days", "next week", "in 2 weeks", "March 8"
- These should feel like a smart personal assistant briefing, not generic tips
- Never mention the user should "check back" or "stay tuned"

Example output format:
[{"emoji":"👋","text":"Good morning, Alex! 3 friends added items this week."},{"emoji":"💝","text":"Valentine's Day is today — still time to find something special!","action":"Find gifts"},{"emoji":"🎁","text":"The Stanley Tumbler is almost funded — only $15 left."},{"emoji":"👩","text":"International Women's Day is March 8 — celebrate the women in your life.","action":"Browse ideas"},{"emoji":"🌸","text":"Mother's Day is 3 months away — never too early to start a list.","action":"Start a list"}]`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

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
    return NextResponse.json({ cards: [], updatedAt: new Date().toISOString() })
  }
}
