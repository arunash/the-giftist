import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTextMessage } from '@/lib/whatsapp'
import { logError } from '@/lib/api-logger'

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1000

// Stage timing: hours after the user's first WhatsApp message (createdAt)
const STAGE_TIMING: Record<number, { minHours: number; maxHours: number }> = {
  1: { minHours: 4, maxHours: 23 },
  2: { minHours: 12, maxHours: 23 },
  3: { minHours: 20, maxHours: 23 },
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getStageMessage(stage: number, name: string | null): string {
  const n = name || 'there'
  switch (stage) {
    case 1:
      return `Hey ${n}! Got anyone's birthday coming up in the next couple months? 🎂`
    case 2:
      return `Hey ${n}! I can suggest gift ideas for anyone — your mom, best friend, partner, anyone.\n\nWant me to try? Just say yes and tell me who!`
    case 3:
      return `Last one from me, ${n}! Want one quick personalized gift suggestion before I go? Yes or no, totally cool either way 😊`
    default:
      return ''
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const testUserId = req.nextUrl.searchParams.get('userId')
  const testStage = req.nextUrl.searchParams.get('stage')
  const now = new Date()

  // Test mode: send a specific stage to a specific user
  if (testUserId && testStage) {
    const stage = parseInt(testStage, 10)
    if (stage < 1 || stage > 3) {
      return NextResponse.json({ error: 'stage must be 1, 2, or 3' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { id: testUserId, phone: { not: null } },
      select: { id: true, phone: true, name: true, followUpStage: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found or has no phone' }, { status: 404 })
    }

    const message = getStageMessage(stage, user.name)
    await sendTextMessage(user.phone!, message)
    await prisma.user.update({
      where: { id: user.id },
      data: { followUpStage: stage, followUpSentAt: now },
    })

    return NextResponse.json({ test: true, userId: user.id, stage, sent: true })
  }

  // Production mode: process each stage
  let totalSent = 0
  const errors: string[] = []
  const stageResults: Record<number, number> = { 1: 0, 2: 0, 3: 0 }

  for (const stage of [1, 2, 3]) {
    const previousStage = stage - 1
    const timing = STAGE_TIMING[stage]
    const minTime = new Date(now.getTime() - timing.maxHours * 60 * 60 * 1000)
    const maxTime = new Date(now.getTime() - timing.minHours * 60 * 60 * 1000)

    // Find users at the previous stage, within the time window, with no items
    const users = await prisma.user.findMany({
      where: {
        phone: { not: null },
        followUpStage: previousStage,
        createdAt: { gte: minTime, lte: maxTime },
        items: { none: {} },
      },
      select: { id: true, phone: true, name: true },
    })

    // Filter to users with only 1 received WhatsApp message (the initial "Hi!")
    const eligible: typeof users = []
    for (const user of users) {
      const msgCount = await prisma.whatsAppMessage.count({
        where: { phone: user.phone!, status: 'RECEIVED' },
      })
      if (msgCount <= 1) {
        eligible.push(user)
      }
    }

    // Send in batches
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (user) => {
          try {
            const message = getStageMessage(stage, user.name)
            await sendTextMessage(user.phone!, message)
            await prisma.user.update({
              where: { id: user.id },
              data: { followUpStage: stage, followUpSentAt: now },
            })
            totalSent++
            stageResults[stage]++
          } catch (e: any) {
            const msg = `Stage ${stage} follow-up failed for ${user.id}: ${e.message}`
            console.error(msg)
            errors.push(msg)
            logError({ source: 'onboarding-followup', message: msg, metadata: { userId: user.id, stage } }).catch(() => {})
          }
        })
      )

      if (i + BATCH_SIZE < eligible.length) {
        await sleep(BATCH_DELAY_MS)
      }
    }
  }

  console.log(`[onboarding-followup] Done: ${totalSent} sent (s1=${stageResults[1]}, s2=${stageResults[2]}, s3=${stageResults[3]}), ${errors.length} errors`)

  return NextResponse.json({
    sent: totalSent,
    stages: stageResults,
    errors: errors.length,
  })
}
