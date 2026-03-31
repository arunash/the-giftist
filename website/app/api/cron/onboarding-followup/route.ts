import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTextMessage } from '@/lib/whatsapp'
import { logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1000

// Onboarding drip: product-first, no feature dumps
// Goal: first save within first session
// Stage 1 (4h): One strong gift suggestion + save prompt
// Stage 2 (12h): Different angle (new category or vibe)
// Stage 3 (20h): Final attempt — "Want me to find something more personal?"
// Stop after 3 attempts.

const STAGE_TIMING: Record<number, { minHours: number; maxHours: number }> = {
  1: { minHours: 4, maxHours: 23 },
  2: { minHours: 12, maxHours: 23 },
  3: { minHours: 20, maxHours: 23 },
}

const SUGGESTION_SYSTEM = `You are a gift concierge. Output ONE short gift description (3-5 words max).

Rules:
- SHORT description only, e.g. "custom star map print" or "leather travel organizer"
- No brand names, no prices, no URLs
- Feel curated and thoughtful, not generic
- Never suggest: mugs, candles, generic Amazon items
- Output ONLY the short description, nothing else`

async function generateSuggestion(context: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: SUGGESTION_SYSTEM,
      messages: [{ role: 'user', content: context }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return text || 'Uncommon Goods Personalized Star Map — $45'
  } catch {
    return 'Uncommon Goods Personalized Star Map — $45'
  }
}

async function getStageMessage(stage: number, name: string | null): Promise<string> {
  const n = name || 'there'

  switch (stage) {
    case 1: {
      // Impress: strong, widely appealing gift
      const suggestion = await generateSuggestion(
        'A universally loved, impressive gift. Something practical but thoughtful.'
      )
      return `Hey ${n} — ${suggestion}. Practical but thoughtful. Want me to save it for you?`
    }
    case 2: {
      // Explore: different direction, more unique
      const suggestion = await generateSuggestion(
        'A unique experience or creative gift. Something unexpected and memorable.'
      )
      return `${n} — how about a ${suggestion}? More unique than typical gifts. Want me to save it?`
    }
    case 3: {
      // Personalize: ask for context
      return `Hey ${n} — tell me who you're shopping for and I'll find the perfect thing. "Gift for my mom who loves cooking" works great.`
    }
    default:
      return ''
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  // Test mode
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

    const message = await getStageMessage(stage, user.name)
    await sendTextMessage(user.phone!, message)
    await prisma.user.update({
      where: { id: user.id },
      data: { followUpStage: stage, followUpSentAt: now },
    })

    return NextResponse.json({ test: true, userId: user.id, stage, sent: true })
  }

  // Production mode
  let totalSent = 0
  const errors: string[] = []
  const stageResults: Record<number, number> = { 1: 0, 2: 0, 3: 0 }

  for (const stage of [1, 2, 3]) {
    const previousStage = stage - 1
    const timing = STAGE_TIMING[stage]
    const minTime = new Date(now.getTime() - timing.maxHours * 60 * 60 * 1000)
    const maxTime = new Date(now.getTime() - timing.minHours * 60 * 60 * 1000)

    // Only target users with no saved items (goal: get first save)
    const users = await prisma.user.findMany({
      where: {
        phone: { not: null },
        followUpStage: previousStage,
        createdAt: { gte: minTime, lte: maxTime },
        items: { none: {} },
      },
      select: { id: true, phone: true, name: true },
    })

    // Filter to low-engagement users (only 1 received message = initial "Hi!")
    const eligible: typeof users = []
    for (const user of users) {
      const msgCount = await prisma.whatsAppMessage.count({
        where: { phone: user.phone!, status: 'RECEIVED' },
      })
      if (msgCount <= 1) {
        eligible.push(user)
      }
    }

    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (user) => {
          try {
            const message = await getStageMessage(stage, user.name)
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
