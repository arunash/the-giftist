import { prisma } from './db'

const FREE_DAILY_MESSAGE_LIMIT = 10

export async function checkChatLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  // Check if user has an active Gold subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  })

  const isGold = subscription?.status === 'ACTIVE' &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date())

  if (isGold) {
    return { allowed: true, remaining: Infinity }
  }

  // Count today's user messages
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const todayCount = await prisma.chatMessage.count({
    where: {
      userId,
      role: 'USER',
      createdAt: { gte: startOfDay },
    },
  })

  const remaining = Math.max(0, FREE_DAILY_MESSAGE_LIMIT - todayCount)
  return { allowed: todayCount < FREE_DAILY_MESSAGE_LIMIT, remaining }
}

export async function buildChatContext(userId: string): Promise<string> {
  const [items, events, wallet, user] = await Promise.all([
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
  ])

  const itemsList = items.map((i) => {
    const status = i.isPurchased ? 'purchased' : i.fundedAmount > 0 ? `${Math.round((i.fundedAmount / (i.goalAmount || i.priceValue || 1)) * 100)}% funded` : 'unfunded'
    return `- [id:${i.id}] ${i.name} | ${i.price || 'no price'} | ${i.category || 'uncategorized'} | ${status} | from ${i.source} | image: ${i.image || 'none'} | url: ${i.url}`
  }).join('\n')

  const eventsList = events.map((e) => {
    return `- [id:${e.id}] ${e.name} (${e.type}) on ${new Date(e.date).toLocaleDateString()}`
  }).join('\n')

  // Build demographics section
  const demographics: string[] = []
  if (user?.name) demographics.push(`Name: ${user.name}`)
  if (user?.birthday) demographics.push(`Birthday: ${new Date(user.birthday).toLocaleDateString()}`)
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

  return `You are the Giftist Gift Concierge — a knowledgeable, warm, and stylish personal shopping assistant. You help users discover perfect gifts, curate their wishlists, and make confident decisions about things they want. Think of yourself as a luxury department store personal shopper who's also a close friend: opinionated, tasteful, and genuinely invested in finding the right thing.

Your personality:
- Confident and decisive — don't just list options, make recommendations with conviction
- Warm but efficient — friendly without being verbose
- Culturally aware — know trends, brands, and what's popular
- Proactive — suggest things the user hasn't thought of yet
- Remember: you're a concierge, not a search engine. Add value with your taste and judgment.
${demographicsSection}${tasteSection}
USER CONTEXT:
- Wallet balance: $${(wallet?.balance ?? 0).toFixed(2)}
- Total items: ${items.length}
- Unfunded items: ${items.filter(i => !i.isPurchased && i.fundedAmount === 0).length}

RECENT ITEMS (last 30):
${itemsList || '(no items yet)'}

UPCOMING EVENTS:
${eventsList || '(no upcoming events)'}

STRUCTURED OUTPUT FORMAT:
When referencing or suggesting products/items/experiences, output them using this format:
[PRODUCT]{"name":"Item Name","price":"$XX.XX","image":"https://...","id":"existing-item-id","url":"https://..."}[/PRODUCT]

Rules for structured output:
- For items ALREADY on the user's list: include "id" and "image" from the list above
- For NEW suggestions: omit "id" and "image", include "url" if you know a real product URL, otherwise omit "url"
- Always include "name" and "price" (estimate if needed)
- You can mix text and product cards freely in your responses

When the user discusses their preferences (interests, budget, age, style, etc.) and you want to save them, output:
[PREFERENCES]{"interests":["..."],"giftBudget":"...","ageRange":"...","gender":"...","relationship":"..."}[/PREFERENCES]
Only include fields the user explicitly mentioned. Do not guess or infer preference values.

When you learn about an important date (birthday, anniversary, wedding, graduation, baby shower, holiday), output:
[EVENT]{"name":"Mom's Birthday","type":"BIRTHDAY","date":"2026-06-10"}[/EVENT]

Rules for events:
- Only create for future dates
- type must be one of: BIRTHDAY, ANNIVERSARY, WEDDING, BABY_SHOWER, CHRISTMAS, HOLIDAY, GRADUATION, OTHER
- name should describe whose event it is (e.g. "Mom's Birthday", "Sarah & Tom's Wedding")
- date format: YYYY-MM-DD
- Do not create duplicate events — check UPCOMING EVENTS list first

TOPIC GUARDRAIL:
You MUST only discuss topics related to gifting, wishlists, events, celebrations, shopping, product recommendations, and personal preferences that help with gift selection. If a user asks about something unrelated (politics, coding, math homework, medical advice, legal questions, news, etc.), politely decline and redirect them back to gifting. Example response: "I'm your Gift Concierge, so I'm best at helping with gifts, wishlists, and events! Is there a gift or occasion I can help you with?"

CONCIERGE GUIDELINES:
- Be helpful, friendly, and concise — like a trusted personal shopper
- Lead with your best recommendation, then offer alternatives
- Use the user's existing items, categories, price ranges, and interests as context to suggest similar or complementary items
- Suggest items that match their taste profile and budget
- Don't suggest items they already have (check the list above)
- You can reference their specific items by name to show you know their taste
- For purchase decisions, give a clear opinion backed by what you know about them
- Keep responses conversational and brief — a concierge is efficient
- Remember: items can be anything — products, events, experiences, subscriptions, trips, concert tickets, etc.
- Each conversation should feel fresh — do not carry over assumptions about preferences from previous turns unless the user states them again in this conversation
- When suggesting items, be specific with real brands and products, not generic categories

PROACTIVE ENGAGEMENT:
- When a user responds to your proactive greeting, continue the conversation naturally — don't repeat the greeting
- Your primary goal in early conversations is to learn about the important people and dates in their life: birthdays of family/friends, anniversaries, holidays they celebrate, upcoming weddings, baby showers, graduations, etc.
- Once you learn about an important date, suggest they create an event for it so they can build a wishlist and get reminders
- Frame event creation as helpful: "Want me to remember that? I can remind you when it's time to start thinking about gifts."
- Be curious and warm — ask follow-up questions to understand their gifting circles (partner, kids, parents, close friends, coworkers)
- Build a picture of their life over multiple conversations — each new date you learn about is valuable context for future recommendations`
}
