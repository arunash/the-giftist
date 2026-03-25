import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractProductFromUrl } from '@/lib/extract'
import { findProductImage } from '@/lib/product-image'
import { findProductUrl } from '@/lib/enrich-item'
import { createTrackedLink } from '@/lib/product-link'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const url = request.nextUrl.searchParams.get('url')
  const name = request.nextUrl.searchParams.get('name')

  if (!url && !name) {
    return NextResponse.json({ error: 'url or name required' }, { status: 400 })
  }

  let image: string | null = null
  let productName: string | null = null
  let price: string | null = null
  let targetUrl: string | null = null
  let urlValid = false

  // Try URL scraping first (existing flow)
  if (url) {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
      }
      // Skip google search fallback URLs
      if (parsed.hostname !== 'www.google.com') {
        try {
          const product = await extractProductFromUrl(url)
          image = product.image
          productName = product.name
          price = product.price
          urlValid = true
          targetUrl = url
        } catch {}
      }
    } catch {
      // Invalid URL — fall through to name-based search
    }
  }

  // If URL was bad or missing, search for a real product URL by name
  if (!urlValid && name) {
    try {
      const found = await findProductUrl(name)
      if (found) {
        targetUrl = found.url
        // Try to scrape image from the found URL
        if (!image) {
          try {
            const product = await extractProductFromUrl(found.url)
            if (product.image) image = product.image
            if (product.name) productName = product.name
            if (product.price) price = product.price
          } catch {}
        }
      }
    } catch {}
  }

  // Fallback: if still no image, search Google Shopping for a thumbnail
  if (!image && name) {
    try {
      image = await findProductImage(name)
    } catch {}
  }

  // Create a Giftist product landing page link
  const displayName = productName || name || 'Product'
  let giftistUrl: string | null = null
  let priceValue: number | null = null
  if (price) {
    const match = price.replace(/,/g, '').match(/[\d.]+/)
    if (match) priceValue = parseFloat(match[0])
  }

  if (targetUrl) {
    try {
      giftistUrl = await createTrackedLink({
        productName: displayName,
        targetUrl,
        price,
        priceValue,
        image,
        userId,
        source: 'CHAT',
      })
    } catch {}
  }

  // Only expose product links when we have an image (no image = no buy/view)
  return NextResponse.json(
    { image, name: productName, price, resolvedUrl: image ? giftistUrl : null, targetUrl: image ? targetUrl : null },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
