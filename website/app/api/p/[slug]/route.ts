import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findProductImage } from '@/lib/product-image'
import { extractProductFromUrl } from '@/lib/extract'
import { aiImageFallback } from '@/lib/ai-image-fallback'

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

    // Always try to resolve image if missing — never cache null
    if (!image) {
      // Try scraping from the target URL first
      if (product.targetUrl && !product.targetUrl.includes('google.com/search')) {
        try {
          const scraped = await extractProductFromUrl(product.targetUrl)
          if (scraped.image) image = scraped.image
        } catch (err) {
          console.error(`[product-image] scrape failed for ${product.targetUrl}:`, err)
        }
      }

      // Fallback: search for product image by name (tries Bing, Google, DDG)
      if (!image) {
        try {
          image = await findProductImage(product.productName)
        } catch (err) {
          console.error(`[product-image] search failed for ${product.productName}:`, err)
        }
      }

      // Layer 3: AI-powered fallback — Claude generates better search queries
      if (!image) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
          image = await aiImageFallback(product.productName, baseUrl)
        } catch (err) {
          console.error(`[product-image] AI fallback failed for ${product.productName}:`, err)
        }
      }

      // Cache real images (not generated ones) for next time
      if (image && !image.includes('/api/product-image')) {
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
