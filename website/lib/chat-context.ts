import { prisma } from './db'

export async function buildChatContext(userId: string): Promise<string> {
  const [items, events, wallet, user] = await Promise.all([
    prisma.item.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      take: 30,
      select: {
        name: true,
        price: true,
        priceValue: true,
        category: true,
        domain: true,
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
      select: { name: true, type: true, date: true },
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
    return `- ${i.name} | ${i.price || 'no price'} | ${i.category || 'uncategorized'} | ${status} | from ${i.source}`
  }).join('\n')

  const eventsList = events.map((e) => {
    return `- ${e.name} (${e.type}) on ${new Date(e.date).toLocaleDateString()}`
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
    ? `\nUSER DEMOGRAPHICS:\n${demographics.map(d => `- ${d}`).join('\n')}\n`
    : ''

  return `You are The Giftist AI assistant. Help users manage their wishlists, find gift ideas, and make purchase decisions.
${demographicsSection}
USER CONTEXT:
- Wallet balance: $${(wallet?.balance ?? 0).toFixed(2)}
- Total items: ${items.length}
- Unfunded items: ${items.filter(i => !i.isPurchased && i.fundedAmount === 0).length}

RECENT ITEMS (last 30):
${itemsList || '(no items yet)'}

UPCOMING EVENTS:
${eventsList || '(no upcoming events)'}

GUIDELINES:
- Be helpful, friendly, and concise
- When suggesting gifts, consider the user's existing items and price range
- You can reference their specific items by name
- For purchase decisions, mention relevant items they already have
- Keep responses conversational and brief`
}
