import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findProductImage } from '@/lib/product-image'
import { extractProductFromUrl } from '@/lib/extract'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  try {
    const product = await prisma.productClick.findUnique({
      where: { slug },
    })

    if (!product) {
      return NextResponse.json(null, { status: 404 })
    }

    // Extract domain from target URL
    let domain = 'retailer'
    try {
      domain = new URL(product.targetUrl).hostname.replace(/^www\./, '')
    } catch {}

    // Track view (fire-and-forget)
    prisma.productClick.update({
      where: { slug },
      data: { clicks: { increment: 1 }, lastClicked: new Date() },
    }).catch(() => {})

    let image = product.image

    // If no image, try to fetch one and cache it
    if (!image) {
      try {
        // Try scraping from the target URL first
        if (product.targetUrl && !product.targetUrl.includes('google.com/search')) {
          const scraped = await extractProductFromUrl(product.targetUrl)
          if (scraped.image) image = scraped.image
        }
      } catch {}

      // Fallback: search for product image by name
      if (!image) {
        try {
          image = await findProductImage(product.productName)
        } catch {}
      }

      // Cache the image for next time (fire-and-forget)
      if (image) {
        prisma.productClick.update({
          where: { slug },
          data: { image },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      slug: product.slug,
      productName: product.productName,
      targetUrl: product.targetUrl,
      price: product.price,
      priceValue: product.priceValue,
      image,
      domain,
    })
  } catch {
    return NextResponse.json(null, { status: 500 })
  }
}
