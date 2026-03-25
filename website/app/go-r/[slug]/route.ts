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
