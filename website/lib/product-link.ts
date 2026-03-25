import { prisma } from '@/lib/db'
import { nanoid } from 'nanoid'

/**
 * Create a tracked product landing page link.
 * Returns a giftist.ai/p/SLUG URL that shows a product page with buy options.
 */
export async function createTrackedLink(opts: {
  productName: string
  targetUrl: string
  price?: string | null
  priceValue?: number | null
  image?: string | null
  userId?: string
  source?: string
}): Promise<string> {
  // Dedup: if same product+target already exists, reuse the slug
  const existing = await prisma.productClick.findFirst({
    where: {
      productName: opts.productName,
      targetUrl: opts.targetUrl,
    },
    select: { slug: true },
  })

  if (existing) {
    // Update image/price if we have better data now
    if (opts.image || opts.price) {
      await prisma.productClick.update({
        where: { slug: existing.slug },
        data: {
          ...(opts.image ? { image: opts.image } : {}),
          ...(opts.price ? { price: opts.price } : {}),
          ...(opts.priceValue != null ? { priceValue: opts.priceValue } : {}),
        },
      }).catch(() => {})
    }
    return `https://giftist.ai/p/${existing.slug}`
  }

  const slug = nanoid(8)

  await prisma.productClick.create({
    data: {
      slug,
      productName: opts.productName,
      targetUrl: opts.targetUrl,
      price: opts.price || null,
      priceValue: opts.priceValue ?? null,
      image: opts.image || null,
      userId: opts.userId || null,
      source: opts.source || 'WEB',
    },
  })

  return `https://giftist.ai/p/${slug}`
}
