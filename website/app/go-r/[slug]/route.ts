import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { applyAffiliateTag } from '@/lib/affiliate'
import { sanitizeUrl } from '@/lib/product-link'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  try {
    const click = await prisma.productClick.findUnique({
      where: { slug },
    })

    if (!click) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const cleanUrl = sanitizeUrl(click.targetUrl)
    if (!cleanUrl) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Track retailer click-through
    const referrer = request.headers.get('referer') || null
    prisma.productClick.update({
      where: { slug },
      data: {
        clicks: { increment: 1 },
        lastClicked: new Date(),
        lastReferrer: referrer,
      },
    }).catch(() => {})
    prisma.clickEvent.create({
      data: {
        slug,
        event: 'RETAILER_CLICK',
        channel: referrer?.includes('from=wa') ? 'WHATSAPP' : 'WEB',
        referrer,
        userAgent: request.headers.get('user-agent') || null,
      },
    }).catch(() => {})

    const affiliateUrl = applyAffiliateTag(cleanUrl)

    return new Response(null, {
      status: 302,
      headers: { Location: affiliateUrl },
    })
  } catch (err) {
    console.error('go-r redirect error:', err)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
