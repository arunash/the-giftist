import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { path, referrer, utmSource, utmMedium, utmCampaign, sessionId } = await request.json()

    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    const session = await getServerSession(authOptions).catch(() => null)
    const userId = (session?.user as any)?.id || null
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') || null

    // Fire-and-forget
    prisma.pageView.create({
      data: {
        path,
        referrer: referrer || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        userAgent,
        ip,
        userId,
        sessionId: sessionId || null,
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // Don't fail user experience
  }
}
