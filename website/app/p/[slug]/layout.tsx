// Per-product metadata (Open Graph + Pinterest Rich Pin tags). The page
// itself is a client component, so SEO/social-preview tags ride on the
// layout's generateMetadata.

import { Metadata } from 'next'
import { prisma } from '@/lib/db'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const click = await prisma.productClick.findUnique({
      where: { slug: params.slug },
      select: { productName: true, image: true, price: true },
    })
    if (!click) {
      return { title: 'Gift · Giftist' }
    }

    const title = `Gift "${click.productName}" via Giftist`
    const description = click.price
      ? `${click.productName} (${click.price}) — gift it via Giftist with personalized recipient capture and concierge support.`
      : `${click.productName} — gift it via Giftist. We capture recipient details, ship it, and send a redeemable link.`
    const url = `https://giftist.ai/p/${params.slug}`
    const image = click.image || 'https://giftist.ai/opengraph-image'

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: 'website',
        images: [{ url: image, width: 1200, height: 1200, alt: click.productName }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
      // Pinterest Rich Pin discovery — og:type=product + og:image is enough
      // for Pinterest to crawl. We also flag rich-pin support explicitly.
      other: {
        'pinterest-rich-pin': 'true',
        'og:price:amount': click.price?.replace(/[^0-9.]/g, '') || '',
        'og:price:currency': 'USD',
      },
    }
  } catch {
    return { title: 'Gift · Giftist' }
  }
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children
}
