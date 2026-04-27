import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTextMessage } from '@/lib/whatsapp'

// Daily cron: finds all SavedReminder rows where remindAt <= now AND
// remindedAt IS NULL, sends a WhatsApp ping with the product link, and
// marks them as sent.
//
// Scheduled in vercel.json. Runs once daily at 16:00 UTC (9am PT).

const BATCH_SIZE = 25
const BATCH_DELAY_MS = 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildReminderMessage(r: {
  productName: string
  productUrl: string | null
  productPrice: string | null
  occasion: string | null
}): string {
  const link = r.productUrl || ''
  const price = r.productPrice ? ` (${r.productPrice})` : ''

  if (r.occasion === 'mothers-day') {
    return [
      `Hey! 🌸 Mother's Day is in 3 days — just a heads up about that gift you saved:`,
      ``,
      `"${r.productName}"${price}`,
      ``,
      `${link}`,
      ``,
      `Order today and it'll arrive in time. Want me to find a backup option just in case?`,
    ].join('\n')
  }

  return [
    `Hey! Reminder about that gift you saved:`,
    ``,
    `"${r.productName}"${price}`,
    ``,
    `${link}`,
    ``,
    `Still on your list? I'm here if you want a different option.`,
  ].join('\n')
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const due = await prisma.savedReminder.findMany({
    where: {
      remindAt: { lte: now },
      remindedAt: null,
    },
    select: {
      id: true,
      phone: true,
      productName: true,
      productUrl: true,
      productPrice: true,
      occasion: true,
    },
    take: 500, // safety cap
  })

  let sent = 0
  const errors: string[] = []

  for (let i = 0; i < due.length; i += BATCH_SIZE) {
    const batch = due.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (r) => {
        try {
          await sendTextMessage(r.phone, buildReminderMessage(r))
          await prisma.savedReminder.update({
            where: { id: r.id },
            data: { remindedAt: new Date() },
          })
          sent++
        } catch (e: any) {
          const msg = `Reminder failed for ${r.id}: ${e.message}`
          console.error(msg)
          errors.push(msg)
        }
      })
    )
    if (i + BATCH_SIZE < due.length) await sleep(BATCH_DELAY_MS)
  }

  console.log(`[saved-reminders] ${sent}/${due.length} sent, ${errors.length} errors`)
  return NextResponse.json({ due: due.length, sent, errors: errors.length })
}
