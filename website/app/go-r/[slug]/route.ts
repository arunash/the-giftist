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
    // Pull utm + sessionId off the query string OR fall back to the referer.
    // Client wraps retailer links to append these so per-campaign attribution works.
    const sp = request.nextUrl.searchParams
    let utmCampaign = sp.get('utm_campaign')
    let utmSource = sp.get('utm_source')
    let sessionId = sp.get('sid')
    // Fallback: parse referer (works when user lands on /shop?utm_campaign=X
    // and clicks Buy from the card directly).
    if (!utmCampaign && referrer) {
      try {
        const refUrl = new URL(referrer)
        utmCampaign = refUrl.searchParams.get('utm_campaign')
        utmSource = utmSource || refUrl.searchParams.get('utm_source')
      } catch {}
    }
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
        utmCampaign: utmCampaign || null,
        utmSource: utmSource || null,
        sessionId: sessionId || null,
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
