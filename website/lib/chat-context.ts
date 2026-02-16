import { prisma } from './db'

const FREE_DAILY_MESSAGE_LIMIT = 10

export async function checkChatLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    }),
  ])

  const isGold = subscription?.status === 'ACTIVE' &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date())

  if (isGold) {
    return { allowed: true, remaining: Infinity }
  }

  // Start of day in user's local timezone (falls back to UTC)
  const startOfUserDay = getStartOfDayInUTC(user?.timezone || 'UTC')

  const todayCount = await prisma.chatMessage.count({
    where: {
      userId,
      role: 'USER',
      createdAt: { gte: startOfUserDay },
    },
  })

  const remaining = Math.max(0, FREE_DAILY_MESSAGE_LIMIT - todayCount)
  return { allowed: todayCount < FREE_DAILY_MESSAGE_LIMIT, remaining }
}

/** Get midnight of the current day in the given timezone, returned as a UTC Date */
function getStartOfDayInUTC(timezone: string): Date {
  // Get today's date string in the user's timezone (YYYY-MM-DD)
  const localDate = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const [year, month, day] = localDate.split('-').map(Number)
  // Find the UTC offset at ~noon local time (avoids DST edge cases at midnight)
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const utcStr = noonUTC.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = noonUTC.toLocaleString('en-US', { timeZone: timezone })
  const offsetMs = new Date(localStr).getTime() - new Date(utcStr).getTime()
  // Midnight local in UTC = midnight UTC - offset
  return new Date(Date.UTC(year, month - 1, day) - offsetMs)
}

export async function buildChatContext(userId: string): Promise<string> {
  const [items, events, wallet, user, circleCount] = await Promise.all([
    prisma.item.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        name: true,
        price: true,
        priceValue: true,
        image: true,
        url: true,
        domain: true,
        category: true,
        fundedAmount: true,
        goalAmount: true,
        isPurchased: true,
        source: true,
      },
    }),
    prisma.event.findMany({
      where: { userId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 5,
      select: { id: true, name: true, type: true, date: true },
    }),
    prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        birthday: true,
        gender: true,
        ageRange: true,
        interests: true,
        giftBudget: true,
        relationship: true,
      },
    }),
    prisma.circleMember.count({ where: { userId } }),
  ])

  const itemsList = items.map((i) => {
    const status = i.isPurchased ? 'purchased' : i.fundedAmount > 0 ? `${Math.round((i.fundedAmount / (i.goalAmount || i.priceValue || 1)) * 100)}% funded` : 'unfunded'
    return `- [id:${i.id}] ${i.name} | ${i.price || 'no price'} | ${i.category || 'uncategorized'} | ${status} | from ${i.domain || i.source} | has_image: ${i.image ? 'yes' : 'no'}`
  }).join('\n')

  const eventsList = events.map((e) => {
    return `- [id:${e.id}] ${e.name} (${e.type}) on ${new Date(e.date).toLocaleDateString()}`
  }).join('\n')

  // Build demographics section
  const demographics: string[] = []
  if (user?.name) demographics.push(`Name: ${user.name}`)
  if (user?.birthday) {
    const bday = new Date(user.birthday)
    const now = new Date()
    const next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
    if (next < now) next.setFullYear(next.getFullYear() + 1)
    const daysUntil = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    demographics.push(`Birthday: ${bday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (${daysUntil} days away)`)
  }
  if (user?.gender) demographics.push(`Gender: ${user.gender.replace('_', ' ').toLowerCase()}`)
  if (user?.ageRange) demographics.push(`Age range: ${user.ageRange}`)
  if (user?.interests) {
    try {
      const parsed = JSON.parse(user.interests)
      if (Array.isArray(parsed) && parsed.length > 0) {
        demographics.push(`Interests: ${parsed.join(', ')}`)
      }
    } catch {}
  }
  if (user?.giftBudget) {
    const budgetLabels: Record<string, string> = {
      UNDER_50: 'Under $50', '50_100': '$50-$100', '100_250': '$100-$250',
      '250_500': '$250-$500', OVER_500: 'Over $500',
    }
    demographics.push(`Typical gift budget: ${budgetLabels[user.giftBudget] || user.giftBudget}`)
  }
  if (user?.relationship) demographics.push(`Household: ${user.relationship.toLowerCase()}`)

  const demographicsSection = demographics.length > 0
    ? `\nUSER PROFILE & PREFERENCES:\n${demographics.map(d => `- ${d}`).join('\n')}\n`
    : ''

  // Derive taste profile from existing items
  const categories = items.filter(i => i.category).map(i => i.category!)
  const domains = [...new Set(items.map(i => i.domain))]
  const priceRange = items.filter(i => i.priceValue).map(i => i.priceValue!)
  const avgPrice = priceRange.length > 0 ? (priceRange.reduce((a, b) => a + b, 0) / priceRange.length) : null
  const maxPrice = priceRange.length > 0 ? Math.max(...priceRange) : null

  const tasteSection = items.length > 0 ? `
TASTE PROFILE (derived from their list):
- Favorite categories: ${[...new Set(categories)].join(', ') || 'not enough data'}
- Preferred stores: ${domains.slice(0, 5).join(', ')}
- Average item price: ${avgPrice ? `$${avgPrice.toFixed(0)}` : 'unknown'}
- Price range: ${maxPrice ? `up to $${maxPrice.toFixed(0)}` : 'unknown'}
- Items are NOT just products -- they include anything the user wants: events, experiences, subscriptions, trips, artists, etc.
` : ''

  return `You are the Giftist Gift Concierge — an opinionated personal shopper who's also a close friend. Confident, tasteful, decisive.

RESPONSE LENGTH — THIS IS CRITICAL:
- Maximum 2-3 sentences for simple questions
- Maximum 4-5 sentences for recommendations (including product cards)
- NEVER write paragraphs. Use short, punchy sentences.
- Lead with your answer or top pick. Skip preamble.
- When suggesting products, let the product cards speak — don't describe what's already in the card.
- One great recommendation beats five okay ones.
${demographicsSection}${tasteSection}
USER CONTEXT:
- Wallet: $${(wallet?.balance ?? 0).toFixed(2)} | Items: ${items.length} | Unfunded: ${items.filter(i => !i.isPurchased && i.fundedAmount === 0).length} | Gift Circle: ${circleCount} ${circleCount === 1 ? 'person' : 'people'}${circleCount === 0 ? ' (suggest adding family/friends to their Gift Circle in Settings so they can be notified about events)' : ''}

ITEMS (last 30):
${itemsList || '(none)'}

UPCOMING EVENTS:
${eventsList || '(none)'}

STRUCTURED OUTPUT:
Products: [PRODUCT]{"name":"...","price":"$XX","image":"url","id":"existing-id","url":"https://..."}[/PRODUCT]
- Existing items: include "id" and "image". New suggestions: omit "id"/"image", include "url" if known.
- Always include "name" and "price".

Preferences: [PREFERENCES]{"interests":["..."],"giftBudget":"...","ageRange":"...","gender":"...","relationship":"..."}[/PREFERENCES]
- Only fields the user explicitly mentioned.

Events (NEW only): [EVENT]{"name":"Mom's Birthday","type":"BIRTHDAY","date":"2026-06-10"}[/EVENT]
- ONLY for creating brand-new events that do NOT exist in UPCOMING EVENTS above.
- NEVER use [EVENT] for events that already exist — that creates duplicates.
- Future dates only. Types: BIRTHDAY, ANNIVERSARY, WEDDING, BABY_SHOWER, CHRISTMAS, HOLIDAY, GRADUATION, OTHER.

Add Item to Event: [ADD_TO_EVENT]{"itemId":"existing-item-id","eventId":"existing-event-id","itemName":"Item Name","eventName":"Event Name"}[/ADD_TO_EVENT]
- For EXISTING items on the user's list: include "itemId" from ITEMS list and "eventId" from UPCOMING EVENTS.
- For NEW product suggestions: omit "itemId", include "price". Do NOT include "url" — the system finds real product URLs automatically.
  Example: [ADD_TO_EVENT]{"eventId":"abc123","itemName":"Ember Temperature Control Smart Mug 2","eventName":"Dad's Birthday","price":"$99.95"}[/ADD_TO_EVENT]
- You can add multiple items in one message with multiple [ADD_TO_EVENT] blocks.
- This is the PRIMARY way to add gifts to events. When suggesting gifts for an event, ALWAYS use [ADD_TO_EVENT] instead of [PRODUCT].
- Do NOT use [PRODUCT] blocks when the user asks to add items to a specific event — use [ADD_TO_EVENT] directly.
- Use specific, real product names (brand + model) so the system can find images automatically.

TOPIC GUARDRAIL:
Only discuss gifting, wishlists, events, celebrations, shopping, and preferences. Politely redirect off-topic questions: "I'm your Gift Concierge — I'm best at gifts, wishlists, and events! What can I help you with?"

GUIDELINES:
- Lead with your best pick, then one alternative max. Don't list-dump.
- Be specific — real brands and products, not generic categories.
- Items can be anything: products, experiences, subscriptions, trips, concert tickets.
- Don't suggest items they already have.
- Reference their items by name to show you know their taste.
- Each conversation is fresh — don't assume prior preferences.
- When the user asks to add items to an event, use [ADD_TO_EVENT] for EACH item — don't use [PRODUCT]. The system auto-creates and links them.
- When suggesting gifts for a specific event, ALWAYS use [ADD_TO_EVENT] so items get linked automatically.

PROACTIVE ENGAGEMENT:
- In early conversations, learn about important people and dates in their life.
- When you learn a date, offer to save it: "Want me to remember that?"
- Ask follow-ups to map their gifting circles (partner, kids, parents, friends).
- Continue naturally after greetings — don't repeat them.`
}
