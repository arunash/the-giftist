import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTextMessage } from '@/lib/whatsapp'
import { logError } from '@/lib/api-logger'

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1000
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
const TWENTY_THREE_HOURS_MS = 23 * 60 * 60 * 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getFollowUpMessage(name: string | null) {
  const greeting = name ? `Hey ${name}!` : 'Hey!'
  return `${greeting} Just checking in — I'm here whenever you're ready.

Here are a few things to try:
- Send me a link to something you love (from any store!)
- Tell me about an upcoming birthday or event
- Or just ask: "Gift ideas for my mom"

I'm your personal gift concierge — no question too small!`
}

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const testUserId = req.nextUrl.searchParams.get('userId')
  const now = new Date()
  const fourHoursAgo = new Date(now.getTime() - FOUR_HOURS_MS)
  const twentyThreeHoursAgo = new Date(now.getTime() - TWENTY_THREE_HOURS_MS)

  let users

  if (testUserId) {
    // For testing, skip time window — just check the user exists with a phone
    users = await prisma.user.findMany({
      where: {
        id: testUserId,
        phone: { not: null },
        followUpSentAt: null,
      },
      select: { id: true, phone: true, name: true },
    })
  } else {
    // Find users who onboarded 4–23 hours ago, never engaged further
    users = await prisma.user.findMany({
      where: {
        phone: { not: null },
        createdAt: {
          gte: twentyThreeHoursAgo,
          lte: fourHoursAgo,
        },
        followUpSentAt: null,
        items: { none: {} },
      },
      select: { id: true, phone: true, name: true },
    })

    // Filter to users with only 1 WhatsApp message (the initial "Hi!")
    const filtered: typeof users = []
    for (const user of users) {
      const msgCount = await prisma.whatsAppMessage.count({
        where: { phone: user.phone!, status: 'RECEIVED' },
      })
      if (msgCount <= 1) {
        filtered.push(user)
      }
    }
    users = filtered
  }

  let sent = 0
  const errors: string[] = []

  // Process in batches
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (user) => {
        try {
          await sendTextMessage(user.phone!, getFollowUpMessage(user.name))
          await prisma.user.update({
            where: { id: user.id },
            data: { followUpSentAt: now },
          })
          sent++
        } catch (e: any) {
          const msg = `Follow-up failed for ${user.id}: ${e.message}`
          console.error(msg)
          errors.push(msg)
          logError({ source: 'onboarding-followup', message: msg, metadata: { userId: user.id } }).catch(() => {})
        }
      })
    )

    // Delay between batches (skip on last batch)
    if (i + BATCH_SIZE < users.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`[onboarding-followup] Done: ${sent} sent, ${errors.length} errors out of ${users.length} eligible`)

  return NextResponse.json({
    eligible: users.length,
    sent,
    errors: errors.length,
  })
}
