import { prisma } from './db'

export async function buildChatContext(userId: string): Promise<string> {
  const [items, events, wallet] = await Promise.all([
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
  ])

  const itemsList = items.map((i) => {
    const status = i.isPurchased ? 'purchased' : i.fundedAmount > 0 ? `${Math.round((i.fundedAmount / (i.goalAmount || i.priceValue || 1)) * 100)}% funded` : 'unfunded'
    return `- ${i.name} | ${i.price || 'no price'} | ${i.category || 'uncategorized'} | ${status} | from ${i.source}`
  }).join('\n')

  const eventsList = events.map((e) => {
    return `- ${e.name} (${e.type}) on ${new Date(e.date).toLocaleDateString()}`
  }).join('\n')

  return `You are The Giftist AI assistant. Help users manage their wishlists, find gift ideas, and make purchase decisions.

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
