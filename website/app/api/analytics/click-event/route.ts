import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ALLOWED_EVENTS = new Set([
  'IMPRESSION',
  'PAGE_VIEW',
  'RETAILER_CLICK',
  'CARD_CLICK',     // user clicked a product card on /shop
  'WA_INTENT',      // user clicked the WhatsApp CTA on /p/SLUG
])
const ALLOWED_CHANNELS = new Set(['WEB', 'WHATSAPP'])

export async function POST(request: NextRequest) {
  try {
    const { slug, event, channel } = await request.json()

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
    }
    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }
    const ch = channel && ALLOWED_CHANNELS.has(channel) ? channel : 'WEB'

    const session = await getServerSession(authOptions).catch(() => null)
    const userId = (session?.user as any)?.id || null
    const userAgent = request.headers.get('user-agent') || null
    const referrer = request.headers.get('referer') || null

    prisma.clickEvent.create({
      data: { slug, event, channel: ch, userId, userAgent, referrer },
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
