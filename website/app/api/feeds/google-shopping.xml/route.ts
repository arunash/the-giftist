import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Cache the feed for 6h — Merchant Center pulls daily, no need for live data.
export const revalidate = 21600

const SITE = 'https://giftist.ai'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function inferBrand(name: string, domain: string | null): string {
  // Google requires brand OR gtin OR mpn. We use the first word of the
  // product name as a brand guess (e.g. "Brooklinen Luxe Sheet Set" → "Brooklinen"),
  // falling back to the retailer hostname.
  const first = name.split(/\s+/)[0].replace(/[^A-Za-z0-9&'.-]/g, '')
  if (first.length >= 2 && first.length <= 50) return first
  if (domain) return domain.replace(/^www\./, '').split('.')[0]
  return 'Various'
}

function inferProductType(occasions: string[], interests: string[]): string {
  const parts: string[] = []
  if (occasions.length > 0) parts.push('Occasion: ' + occasions[0])
  if (interests.length > 0) parts.push('Interest: ' + interests[0])
  return parts.join(' > ') || 'Gifts'
}

export async function GET(request: NextRequest) {
  const products = await prisma.tastemakerGift.findMany({
    where: {
      reviewStatus: 'approved',
      url: { not: null },
      NOT: [{ url: '' }, { image: null }, { image: '' }],
      priceValue: { not: null, gt: 0 },
    },
    select: {
      id: true, name: true, price: true, priceValue: true,
      url: true, domain: true, image: true, why: true,
      occasions: true, interests: true,
    },
    orderBy: { totalScore: 'desc' },
    take: 2000,
  })

  const items = products.map(p => {
    const id = p.id
    const title = (p.name || '').slice(0, 150)
    const description = (p.why || `Hand-picked gift recommendation: ${title}.`).slice(0, 5000)
    // Send shoppers to /p/SLUG via the product's id-based redirect path so we
    // can attribute Google Shopping clicks separately from Meta.
    const link = `${SITE}/p/${id}?utm_source=google&utm_medium=cpc&utm_campaign=shopping_feed`
    const imageLink = p.image!
    const price = `${p.priceValue!.toFixed(2)} USD`
    const brand = inferBrand(p.name, p.domain)
    const productType = inferProductType(p.occasions, p.interests)

    return `    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:title>${escapeXml(title)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${escapeXml(price)}</g:price>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${escapeXml(productType)}</g:product_type>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Standard</g:service>
        <g:price>0.00 USD</g:price>
      </g:shipping>
    </item>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Giftist — Curated Gift Recommendations</title>
    <link>${SITE}/shop</link>
    <description>${products.length} hand-picked gifts vetted by Wirecutter, The Strategist, and Oprah's editors.</description>
${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=21600',
    },
  })
}
