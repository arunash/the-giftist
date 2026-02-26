import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { applyAffiliateTag } from '@/lib/affiliate'

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

    // Increment click count (fire-and-forget)
    prisma.productClick.update({
      where: { slug },
      data: { clicks: { increment: 1 }, lastClicked: new Date() },
    }).catch(() => {})

    // Apply affiliate tag and redirect
    const affiliateUrl = applyAffiliateTag(click.targetUrl)
    return NextResponse.redirect(affiliateUrl, 302)
  } catch {
    return NextResponse.redirect(new URL('/', request.url))
  }
}
