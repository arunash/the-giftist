import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import {
  listCampaigns,
  getCampaignInsights,
  getAccountInsights,
  createFullCampaign,
  pauseCampaign,
  generateHolidayAdCopy,
  GIFT_INTERESTS,
} from '@/lib/meta-ads'

// GET: Fetch all campaigns + sync performance from Meta API
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { searchParams } = new URL(req.url)
  const sync = searchParams.get('sync') === '1'

  // Get local campaigns
  const localCampaigns = await prisma.metaCampaign.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // If sync requested, pull latest from Meta API
  if (sync && process.env.META_ACCESS_TOKEN) {
    try {
      const metaCampaigns = await listCampaigns()

      for (const mc of metaCampaigns) {
        const insights = await getCampaignInsights(mc.id)
        const messageActions = insights?.actions?.find(
          (a) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        )

        const existing = localCampaigns.find((l) => l.metaCampaignId === mc.id)
        const updateData = {
          name: mc.name,
          status: mc.status,
          spend: insights?.spend || 0,
          impressions: insights?.impressions || 0,
          clicks: insights?.clicks || 0,
          messages: messageActions ? parseInt(messageActions.value) : 0,
          cpc: insights?.cpc || 0,
          ctr: insights?.ctr || 0,
          cpm: insights?.cpm || 0,
          lastSyncAt: new Date(),
        }

        if (existing) {
          await prisma.metaCampaign.update({
            where: { id: existing.id },
            data: updateData,
          })
        } else {
          await prisma.metaCampaign.create({
            data: {
              metaCampaignId: mc.id,
              objective: mc.objective || 'ENGAGEMENT',
              dailyBudget: mc.daily_budget ? parseInt(mc.daily_budget) / 100 : 5,
              startDate: new Date(),
              ...updateData,
            },
          })
        }
      }
    } catch (err: any) {
      console.error('Meta sync error:', err.message)
    }
  }

  // Re-fetch after sync
  const campaigns = await prisma.metaCampaign.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Account-level totals
  const totals = {
    totalSpend: campaigns.reduce((s, c) => s + c.spend, 0),
    totalImpressions: campaigns.reduce((s, c) => s + c.impressions, 0),
    totalClicks: campaigns.reduce((s, c) => s + c.clicks, 0),
    totalMessages: campaigns.reduce((s, c) => s + c.messages, 0),
    activeCampaigns: campaigns.filter((c) => c.status === 'ACTIVE').length,
    avgCpc: 0,
    avgCtr: 0,
  }

  if (totals.totalClicks > 0) {
    totals.avgCpc = totals.totalSpend / totals.totalClicks
  }
  if (totals.totalImpressions > 0) {
    totals.avgCtr = (totals.totalClicks / totals.totalImpressions) * 100
  }

  return NextResponse.json({ campaigns, totals })
}

// POST: Create a new campaign or perform an action
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { name, dailyBudget, adText, headline, startDate, endDate, holidaySlug } = body

    if (!process.env.META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Meta API not configured. Set META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID in env.' }, { status: 400 })
    }

    try {
      const result = await createFullCampaign({
        name,
        dailyBudget: dailyBudget || 5,
        adText,
        headline,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        interests: GIFT_INTERESTS,
      })

      const campaign = await prisma.metaCampaign.create({
        data: {
          metaCampaignId: result.campaignId,
          metaAdSetId: result.adSetId,
          metaAdId: result.adId,
          name,
          dailyBudget: dailyBudget || 5,
          adText,
          headline,
          holidaySlug: holidaySlug || null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
        },
      })

      return NextResponse.json({ success: true, campaign })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  if (action === 'pause') {
    const { campaignId } = body
    const campaign = await prisma.metaCampaign.findUnique({ where: { id: campaignId } })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    try {
      if (process.env.META_ACCESS_TOKEN) {
        await pauseCampaign(campaign.metaCampaignId)
      }
      await prisma.metaCampaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED' },
      })
      return NextResponse.json({ success: true })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  if (action === 'generate_copy') {
    const { holidayName } = body
    const copy = generateHolidayAdCopy(holidayName)
    return NextResponse.json(copy)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
