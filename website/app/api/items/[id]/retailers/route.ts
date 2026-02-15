import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { searchRetailers } from '@/lib/search-retailers'
import { applyAffiliateTag } from '@/lib/affiliate'
import { logApiCall, logError } from '@/lib/api-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const item = await prisma.item.findFirst({
      where: { id },
      select: { name: true, url: true, domain: true, price: true, priceValue: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const { results } = await searchRetailers(item.name, null, null)

    logApiCall({
      provider: 'OPENAI',
      endpoint: '/responses',
      model: 'gpt-4o',
      source: 'WEB',
      metadata: { context: 'retailer-search', itemId: id },
    }).catch(() => {})

    // Build retailer list — include the original retailer
    const originalRetailer = {
      retailer: item.domain,
      url: applyAffiliateTag(item.url),
      price: item.price,
      priceValue: item.priceValue,
      isOriginal: true,
    }

    // De-duplicate: skip search results from the same domain as the original
    const otherRetailers = results
      .filter((r) => {
        try {
          const rHost = new URL(r.url).hostname.toLowerCase()
          const origHost = new URL(item.url).hostname.toLowerCase()
          return rHost !== origHost
        } catch {
          return true
        }
      })
      .map((r) => ({
        retailer: r.retailer,
        url: applyAffiliateTag(r.url),
        price: r.price,
        priceValue: r.priceValue,
        isOriginal: false,
      }))

    return NextResponse.json({
      retailers: [originalRetailer, ...otherRetailers],
    })
  } catch (error) {
    console.error('Error fetching retailers:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to fetch retailers' },
      { status: 500 }
    )
  }
}
