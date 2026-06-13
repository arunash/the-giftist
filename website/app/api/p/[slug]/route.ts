import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findProductImage } from '@/lib/product-image'
import { extractProductFromUrl } from '@/lib/extract'
import { aiImageFallback } from '@/lib/ai-image-fallback'
import { scrapeAmazonPrice } from '@/lib/scrape-amazon-price'
import { isBotUserAgent } from '@/lib/is-bot'

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

    // Track page view (fire-and-forget) — separate from retailer clicks.
    // Skip bots so the metrics reflect real users only.
    const isBot = isBotUserAgent(request.headers.get('user-agent'))
    if (!isBot) {
      prisma.productClick.update({
        where: { slug },
        data: { views: { increment: 1 } },
      }).catch(() => {})
      prisma.clickEvent.create({
        data: {
          slug,
          event: 'PAGE_VIEW',
          channel: request.nextUrl.searchParams.get('from') === 'wa' ? 'WHATSAPP' : 'WEB',
          userId: null,
          referrer: request.headers.get('referer') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      }).catch(() => {})
    }

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

    // Live Amazon price scrape — only when we don't have a stored price
    // and the URL is Amazon. Adds up to 6s of latency on the first visit
    // for affected products, then caches forever. Subsequent visits are
    // instant. Falls back gracefully (returns null) if Amazon blocks us.
    let priceValue = product.priceValue
    let priceStr = product.price
    if (!priceValue && product.targetUrl) {
      const scraped = await scrapeAmazonPrice(product.targetUrl)
      if (scraped) {
        priceValue = scraped
        priceStr = `$${scraped.toFixed(2)}`
        // Cache: ProductClick + matching TastemakerGift
        prisma.productClick.update({
          where: { slug },
          data: { priceValue: scraped, price: priceStr },
        }).catch(() => {})
        prisma.tastemakerGift.updateMany({
          where: { name: product.productName, priceValue: null },
          data: { priceValue: scraped, price: priceStr },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      slug: product.slug,
      productName: product.productName,
      targetUrl: product.targetUrl,
      price: priceStr,
      priceValue,
      image,
      domain,
    })
  } catch {
    return NextResponse.json(null, { status: 500 })
  }
}
