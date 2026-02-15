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
        where: { userId },
        orderBy: { date: 'asc' },
        take: 5,
        select: { name: true, type: true, date: true },
      }),
    ])

    if (!user) {
      return NextResponse.json({ greeting: null })
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

    const prompt = `Generate a single short, warm, proactive greeting message (2-3 sentences max) from the Giftist Gift Concierge to a user who just opened the app. The tone should be like a friendly personal shopper checking in.

User context:
- Name: ${firstName}
- Time greeting: ${greeting}
- Account age: ${accountAgeDays} days
- Items on wishlist: ${itemCount}
- Has upcoming events: ${hasEvents}${upcomingEvents.length > 0 ? ` (${upcomingEvents.join(', ')})` : ''}
- Profile gaps (things we don't know yet): ${profileGaps.length > 0 ? profileGaps.join(', ') : 'profile is complete'}
- Is brand new user: ${isNew}

Rules:
- Always end with a specific question to engage the user
- If they're missing important dates, ask about upcoming birthdays/anniversaries/special occasions in their life — frame it as wanting to help them prepare gift lists ahead of time
- If they have an upcoming event, reference it and ask if they need help curating a list
- If they're new with no items, welcome them warmly and ask about the most important people in their life they'd want to build gift lists for
- If their profile is complete and they have events, give a more specific, personalized check-in
- Do NOT use emojis
- Do NOT use the [PRODUCT] or [PREFERENCES] format
- Keep it conversational, 2-3 sentences max
- Output ONLY the greeting message text, nothing else`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
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

    const text =
      response.content[0].type === 'text' ? response.content[0].text.trim() : null

    return NextResponse.json({ greeting: text })
  } catch (error) {
    console.error('Greeting generation error:', error)
    logError({ source: 'CHAT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ greeting: null })
  }
}
