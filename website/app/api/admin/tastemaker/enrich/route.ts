import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { findProductUrl } from '@/lib/enrich-item'
import { searchRetailers } from '@/lib/search-retailers'

// Enrich tastemaker products with images and URLs
// POST /api/admin/tastemaker/enrich?limit=20
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const forceRefresh = req.nextUrl.searchParams.get('force') === '1'

  // Find approved products missing images, ordered by score
  const products = await prisma.tastemakerGift.findMany({
    where: {
      reviewStatus: 'approved',
      ...(forceRefresh ? {} : {
        OR: [
          { image: null },
          { image: '' },
          { url: null },
          { url: '' },
        ],
      }),
    },
    orderBy: { totalScore: 'desc' },
    take: limit,
    select: {
      id: true,
      name: true,
      url: true,
      image: true,
      domain: true,
      price: true,
      priceValue: true,
    },
  })

  const results: Array<{ name: string; status: string; image?: string; url?: string }> = []

  for (const product of products) {
    try {
      let url = product.url
      let image = product.image
      let domain = product.domain
      let price = product.price
      let priceValue = product.priceValue

      // Step 1: Find URL if missing
      if (!url) {
        const found = await findProductUrl(product.name)
        if (found) {
          url = found.url
          domain = found.domain
          if (found.price) price = found.price
          if (found.priceValue) priceValue = found.priceValue
        }
      }

      // Step 2: Find image if missing — scrape from URL or search
      if (!image && url) {
        try {
          const { extractProductFromUrl } = await import('@/lib/extract')
          const extracted = await extractProductFromUrl(url)
          if (extracted?.image) {
            image = extracted.image
            if (!price && extracted.price) price = extracted.price
            if (!priceValue && extracted.priceValue) priceValue = extracted.priceValue
          }
        } catch {}
      }

      // Step 3: If still no image, try Google Shopping image search
      if (!image) {
        try {
          const searchRes = await searchRetailers(product.name)
          if (searchRes.bestResult?.url) {
            if (!url) {
              url = searchRes.bestResult.url
              domain = new URL(searchRes.bestResult.url).hostname.replace('www.', '')
            }
            if (searchRes.bestResult.price) price = searchRes.bestResult.price
          }
        } catch {}
      }

      // Step 4: Try fetching OG image from URL
      if (!image && url) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(8000),
            redirect: 'follow',
          })
          const html = await res.text()
          const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
          if (ogMatch?.[1]) {
            image = ogMatch[1]
          }
        } catch {}
      }

      // Update the product
      const updateData: any = {}
      if (url && url !== product.url) updateData.url = url
      if (image && image !== product.image) updateData.image = image
      if (domain && domain !== product.domain) updateData.domain = domain
      if (price && price !== product.price) updateData.price = price
      if (priceValue && priceValue !== product.priceValue) updateData.priceValue = priceValue
      updateData.lastScrapedAt = new Date()

      if (Object.keys(updateData).length > 1) {
        await prisma.tastemakerGift.update({
          where: { id: product.id },
          data: updateData,
        })
      }

      results.push({
        name: product.name,
        status: image ? 'enriched' : url ? 'url_only' : 'failed',
        image: image || undefined,
        url: url || undefined,
      })
    } catch (err) {
      results.push({
        name: product.name,
        status: `error: ${(err as Error).message}`,
      })
    }
  }

  const enriched = results.filter(r => r.status === 'enriched').length
  const urlOnly = results.filter(r => r.status === 'url_only').length
  const failed = results.filter(r => r.status === 'failed' || r.status.startsWith('error')).length

  return NextResponse.json({
    processed: results.length,
    enriched,
    urlOnly,
    failed,
    results,
  })
}
