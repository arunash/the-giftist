import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'

/**
 * Create a tracked redirect link for a product URL.
 * Returns a giftist.ai/go/SLUG URL that logs clicks and appends affiliate tags on redirect.
 */
export async function createTrackedLink(opts: {
  productName: string
  targetUrl: string
  userId?: string
  source?: string
}): Promise<string> {
  const slug = nanoid(8)

  await prisma.productClick.create({
    data: {
      slug,
      productName: opts.productName,
      targetUrl: opts.targetUrl,
      userId: opts.userId || null,
      source: opts.source || 'WEB',
    },
  })

  return `https://giftist.ai/go/${slug}`
}
