import { prisma } from './db'

const DEDUP_WINDOW_DAYS = 7
const MAX_SUGGESTIONS_PER_PRODUCT = 2

function normalizeProductName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Get product names that have been suggested >= MAX times in the past week.
 * Returns a list of original product names to exclude.
 */
export async function getOverSuggestedProducts(): Promise<string[]> {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const counts = await prisma.productSuggestion.groupBy({
    by: ['nameKey'],
    _count: { id: true },
    where: { createdAt: { gte: cutoff } },
    having: { id: { _count: { gte: MAX_SUGGESTIONS_PER_PRODUCT } } },
  })

  if (counts.length === 0) return []

  // Get one original name per nameKey
  const overUsed = await prisma.productSuggestion.findMany({
    where: {
      nameKey: { in: counts.map(c => c.nameKey) },
      createdAt: { gte: cutoff },
    },
    distinct: ['nameKey'],
    select: { productName: true },
  })

  return overUsed.map(p => p.productName)
}

/**
 * Record product suggestions from a chat response or trending results.
 * Extracts product names from [PRODUCT] blocks or a provided list.
 */
export async function trackSuggestedProducts(
  productNames: string[],
  source: string = 'CHAT',
  userId?: string,
): Promise<void> {
  if (productNames.length === 0) return

  const records = productNames.map(name => ({
    productName: name,
    nameKey: normalizeProductName(name),
    source,
    userId: userId || null,
  }))

  await prisma.productSuggestion.createMany({ data: records }).catch(() => {})
}

/**
 * Extract product names from chat content that contains [PRODUCT] blocks.
 */
export function extractProductNamesFromContent(content: string): string[] {
  const regex = /\[PRODUCT\]\s*(\{[\s\S]*?\})\s*\[\/PRODUCT\]/g
  const names: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1])
      if (data.name) names.push(data.name)
    } catch {
      // skip malformed
    }
  }
  return names
}
