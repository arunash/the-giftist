import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { sendTextMessage } from '@/lib/whatsapp'
import { generateDigestData, formatDigestEmail, formatDigestWhatsApp } from '@/lib/digest'
import { logError } from '@/lib/api-logger'

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1000
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  const sixDaysAgo = new Date(now.getTime() - SIX_DAYS_MS)

  // Find eligible users
  const whereClause: any = {
    digestOptOut: false,
    OR: [
      { email: { not: null } },
      { phone: { not: null } },
    ],
    AND: [
      {
        OR: [
          { items: { some: {} } },
          { events: { some: {} } },
        ],
      },
      {
        OR: [
          { lastDigestSentAt: null },
          { lastDigestSentAt: { lt: sixDaysAgo } },
        ],
      },
    ],
  }

  if (testUserId) {
    whereClause.id = testUserId
    // For testing, skip the lastDigestSentAt check
    delete whereClause.AND
    whereClause.OR = [
      { items: { some: {} } },
      { events: { some: {} } },
    ]
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: { id: true, email: true, phone: true, name: true },
  })

  let emailsSent = 0
  let whatsappSent = 0
  let skipped = 0
  const errors: string[] = []

  // Process in batches
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (user) => {
        try {
          const data = await generateDigestData(user.id)
          if (!data) {
            skipped++
            return
          }

          // Send email if user has email
          if (user.email) {
            try {
              const html = formatDigestEmail(data)
              await sendEmail({
                to: user.email,
                subject: `🎁 Your Weekly Giftist Update`,
                html,
              })
              emailsSent++
            } catch (e: any) {
              const msg = `Email failed for ${user.id}: ${e.message}`
              console.error(msg)
              errors.push(msg)
              logError({ source: 'weekly-digest', message: msg, metadata: { userId: user.id } }).catch(() => {})
            }
          }

          // Send WhatsApp if user has phone
          if (user.phone) {
            try {
              const text = formatDigestWhatsApp(data)
              await sendTextMessage(user.phone, text)
              whatsappSent++
            } catch (e: any) {
              const msg = `WhatsApp failed for ${user.id}: ${e.message}`
              console.error(msg)
              errors.push(msg)
              logError({ source: 'weekly-digest', message: msg, metadata: { userId: user.id } }).catch(() => {})
            }
          }

          // Mark digest as sent
          await prisma.user.update({
            where: { id: user.id },
            data: { lastDigestSentAt: now },
          })
        } catch (e: any) {
          const msg = `Digest failed for ${user.id}: ${e.message}`
          console.error(msg)
          errors.push(msg)
          logError({ source: 'weekly-digest', message: msg, stack: e.stack, metadata: { userId: user.id } }).catch(() => {})
        }
      })
    )

    // Delay between batches (skip on last batch)
    if (i + BATCH_SIZE < users.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`[weekly-digest] Done: ${emailsSent} emails, ${whatsappSent} WhatsApp, ${skipped} skipped, ${errors.length} errors`)

  return NextResponse.json({
    usersProcessed: users.length,
    emailsSent,
    whatsappSent,
    skipped,
    errors: errors.length,
  })
}
