import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractProductFromUrl } from '@/lib/extract'
import { findProductImage } from '@/lib/product-image'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('url')
  const name = request.nextUrl.searchParams.get('name')

  if (!url && !name) {
    return NextResponse.json({ error: 'url or name required' }, { status: 400 })
  }

  let image: string | null = null
  let productName: string | null = null
  let price: string | null = null

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
        } catch {}
      }
    } catch {
      // Invalid URL — fall through to name-based search
    }
  }

  // Fallback: if URL scraping didn't produce an image and we have a product name,
  // search Google Shopping for a thumbnail
  if (!image && name) {
    try {
      image = await findProductImage(name)
    } catch {}
  }

  return NextResponse.json(
    { image, name: productName, price },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
