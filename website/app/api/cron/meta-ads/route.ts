import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  listCampaigns,
  getCampaignInsights,
  createFullCampaign,
  pauseCampaign,
  generateHolidayAdCopy,
  GIFT_INTERESTS,
} from '@/lib/meta-ads'
import { logError } from '@/lib/api-logger'

// Cron: Sync Meta campaign performance + auto-create holiday campaigns
// Run daily via Vercel cron or external scheduler
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json({ message: 'Meta API not configured, skipping' })
  }

  const results = { synced: 0, created: 0, paused: 0, errors: [] as string[] }

  // ── 1. Sync existing campaign performance ──
  try {
    const metaCampaigns = await listCampaigns()
    for (const mc of metaCampaigns) {
      try {
        const insights = await getCampaignInsights(mc.id)
        const msgAction = insights?.actions?.find(
          (a) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        )

        await prisma.metaCampaign.upsert({
          where: { metaCampaignId: mc.id },
          update: {
            name: mc.name,
            status: mc.status,
            spend: insights?.spend || 0,
            impressions: insights?.impressions || 0,
            clicks: insights?.clicks || 0,
            messages: msgAction ? parseInt(msgAction.value) : 0,
            cpc: insights?.cpc || 0,
            ctr: insights?.ctr || 0,
            cpm: insights?.cpm || 0,
            lastSyncAt: new Date(),
          },
          create: {
            metaCampaignId: mc.id,
            name: mc.name,
            objective: mc.objective || 'ENGAGEMENT',
            status: mc.status,
            dailyBudget: mc.daily_budget ? parseInt(mc.daily_budget) / 100 : 5,
            spend: insights?.spend || 0,
            impressions: insights?.impressions || 0,
            clicks: insights?.clicks || 0,
            messages: msgAction ? parseInt(msgAction.value) : 0,
            cpc: insights?.cpc || 0,
            ctr: insights?.ctr || 0,
            cpm: insights?.cpm || 0,
            startDate: new Date(),
            lastSyncAt: new Date(),
          },
        })
        results.synced++
      } catch (err: any) {
        results.errors.push(`Sync ${mc.id}: ${err.message}`)
      }
    }
  } catch (err: any) {
    results.errors.push(`List campaigns: ${err.message}`)
  }

  // ── 2. Auto-pause expired campaigns ──
  const expiredCampaigns = await prisma.metaCampaign.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: new Date() },
    },
  })

  for (const c of expiredCampaigns) {
    try {
      await pauseCampaign(c.metaCampaignId)
      await prisma.metaCampaign.update({
        where: { id: c.id },
        data: { status: 'COMPLETED' },
      })
      results.paused++
    } catch (err: any) {
      results.errors.push(`Pause ${c.name}: ${err.message}`)
    }
  }

  // ── 3. Auto-create upcoming holiday campaigns ──
  // Only creates if no existing campaign for that holiday slug
  const HOLIDAYS_TO_PROMOTE = [
    { name: "Mother's Day", month: 5, day: 11, slug: 'mothers-day' },
    { name: "Father's Day", month: 6, day: 15, slug: 'fathers-day' },
    { name: "Valentine's Day", month: 2, day: 14, slug: 'valentines' },
    { name: 'Christmas', month: 12, day: 25, slug: 'christmas' },
    { name: 'Thanksgiving', month: 11, day: 27, slug: 'thanksgiving' },
    { name: 'Graduation', month: 6, day: 1, slug: 'graduation' },
  ]

  const now = new Date()
  const year = now.getFullYear()

  for (const holiday of HOLIDAYS_TO_PROMOTE) {
    const holidayDate = new Date(year, holiday.month - 1, holiday.day)
    const daysUntil = Math.floor((holidayDate.getTime() - now.getTime()) / 86400000)

    // Create campaign 21 days before, end on the holiday
    if (daysUntil > 0 && daysUntil <= 21) {
      const existing = await prisma.metaCampaign.findFirst({
        where: {
          holidaySlug: holiday.slug,
          startDate: { gte: new Date(year, 0, 1) }, // this year
          status: { not: 'ERROR' },
        },
      })

      if (!existing) {
        try {
          const copy = generateHolidayAdCopy(holiday.name)
          const result = await createFullCampaign({
            name: `${holiday.name} ${year} — WhatsApp`,
            dailyBudget: 5,
            adText: copy.text,
            headline: copy.headline,
            startDate: now,
            endDate: holidayDate,
            interests: GIFT_INTERESTS,
          })

          await prisma.metaCampaign.create({
            data: {
              metaCampaignId: result.campaignId,
              metaAdSetId: result.adSetId,
              metaAdId: result.adId,
              name: `${holiday.name} ${year} — WhatsApp`,
              dailyBudget: 5,
              adText: copy.text,
              headline: copy.headline,
              holidaySlug: holiday.slug,
              startDate: now,
              endDate: holidayDate,
            },
          })
          results.created++
        } catch (err: any) {
          results.errors.push(`Create ${holiday.name}: ${err.message}`)
          await logError({ source: 'meta-ads-cron', message: err.message, metadata: { holiday: holiday.name } }).catch(() => {})
        }
      }
    }
  }

  if (results.errors.length) {
    console.error('Meta ads cron errors:', results.errors)
  }

  return NextResponse.json(results)
}
