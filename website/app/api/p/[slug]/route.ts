import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

    return NextResponse.json({
      slug: product.slug,
      productName: product.productName,
      targetUrl: product.targetUrl,
      price: product.price,
      priceValue: product.priceValue,
      image: product.image,
      domain,
    })
  } catch {
    return NextResponse.json(null, { status: 500 })
  }
}
