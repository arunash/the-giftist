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
      // Step 1: Get campaign list
      const metaCampaigns = await listCampaigns()

      // Step 2: Pull ALL insights at campaign level in one call (much faster + works with ad-set budgets)
      const token = process.env.META_ACCESS_TOKEN!.trim()
      const adAccountId = process.env.META_AD_ACCOUNT_ID!.trim()
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) // last 30 days
      const until = new Date().toISOString().slice(0, 10)
      const insightsRes = await fetch(
        `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions&level=campaign&time_range={"since":"${since}","until":"${until}"}&limit=100&access_token=${token}`
      )
      const insightsData = await insightsRes.json()
      const insightsByCampaign = new Map<string, any>()
      for (const row of insightsData.data || []) {
        insightsByCampaign.set(row.campaign_id, row)
      }

      // Step 3: Clear old entries and rebuild from scratch (avoids duplicates)
      await prisma.metaCampaign.deleteMany({})

      for (const mc of metaCampaigns) {
        const insights = insightsByCampaign.get(mc.id)
        const messageActions = insights?.actions?.find(
          (a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        )

        await prisma.metaCampaign.create({
          data: {
            metaCampaignId: mc.id,
            name: mc.name,
            objective: mc.objective || 'ENGAGEMENT',
            status: mc.status,
            dailyBudget: mc.daily_budget ? parseInt(mc.daily_budget) / 100 : 5,
            spend: insights ? parseFloat(insights.spend) : 0,
            impressions: insights ? parseInt(insights.impressions) : 0,
            clicks: insights ? parseInt(insights.clicks) : 0,
            messages: messageActions ? parseInt(messageActions.value) : 0,
            cpc: insights?.cpc ? parseFloat(insights.cpc) : 0,
            ctr: insights?.ctr ? parseFloat(insights.ctr) : 0,
            cpm: insights?.cpm ? parseFloat(insights.cpm) : 0,
            startDate: mc.created_time ? new Date(mc.created_time) : new Date(),
            lastSyncAt: new Date(),
          },
        })
      }
    } catch (err: any) {
      console.error('Meta sync error:', err.message)
    }
  }

  // Re-fetch after sync
  const campaigns = await prisma.metaCampaign.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Real WhatsApp conversations: users with phone who sent messages
  const realConversations = await prisma.user.count({
    where: {
      phone: { not: null },
      chatMessages: { some: { role: 'USER' } },
    },
  })

  // Engaged users: sent 2+ messages (had a real back-and-forth)
  const engagedUsers = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM (
      SELECT u.id FROM "User" u
      JOIN "ChatMessage" cm ON cm."userId" = u.id
      WHERE u.phone IS NOT NULL AND cm.role = 'USER'
      GROUP BY u.id HAVING COUNT(*) >= 2
    ) sub
  `

  // New WA users today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const newWaUsersToday = await prisma.user.count({
    where: {
      phone: { not: null },
      createdAt: { gte: today },
    },
  })

  // Conversations today (users who signed up today AND chatted)
  const conversationsToday = await prisma.user.count({
    where: {
      phone: { not: null },
      createdAt: { gte: today },
      chatMessages: { some: { role: 'USER' } },
    },
  })

  // Recent conversations with details
  const recentConversations = await prisma.user.findMany({
    where: {
      phone: { not: null },
      chatMessages: { some: { role: 'USER' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      name: true,
      phone: true,
      createdAt: true,
      _count: { select: { chatMessages: true, items: true } },
      chatMessages: {
        where: { role: 'USER' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { content: true },
      },
    },
  })

  // Account-level totals
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totals = {
    totalSpend,
    totalImpressions: campaigns.reduce((s, c) => s + c.impressions, 0),
    totalClicks: campaigns.reduce((s, c) => s + c.clicks, 0),
    totalMessages: campaigns.reduce((s, c) => s + c.messages, 0),
    realConversations,
    engagedUsers: Number(engagedUsers[0]?.count || 0),
    newWaUsersToday,
    conversationsToday,
    activeCampaigns: campaigns.filter((c) => c.status === 'ACTIVE').length,
    avgCpc: 0,
    avgCtr: 0,
    costPerRealConversation: realConversations > 0 ? totalSpend / realConversations : 0,
  }

  if (totals.totalClicks > 0) {
    totals.avgCpc = totals.totalSpend / totals.totalClicks
  }
  if (totals.totalImpressions > 0) {
    totals.avgCtr = (totals.totalClicks / totals.totalImpressions) * 100
  }

  // Mask phone numbers for privacy
  const conversations = recentConversations.map((u) => ({
    id: u.id,
    name: u.name || 'Unknown',
    phone: u.phone ? `...${u.phone.slice(-4)}` : '?',
    createdAt: u.createdAt,
    messageCount: u._count.chatMessages,
    itemsSaved: u._count.items,
    firstMessage: u.chatMessages[0]?.content?.slice(0, 100) || '',
  }))

  return NextResponse.json({ campaigns, totals, conversations })
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
