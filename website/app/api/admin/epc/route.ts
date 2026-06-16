import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ADMIN_USER_IDS = new Set(['cmliwct6c00009zxu0g7rns32'])

/**
 * The profitability question, answered with REAL data:
 *   EPC (earnings per retailer click) = confirmed commission / retailer clicks
 * vs the blended cost-per-retailer-click of the ad spend. If EPC < CPC, every
 * click loses money — keep spend frozen. This replaces the rough "5% convert ×
 * $50 cart" projection in shop-funnel with actual AffiliateConversion rows.
 *
 * ?range=24h|7d|30d|all   ?cpc=2.32 (blended cost per retailer click to beat)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId || !ADMIN_USER_IDS.has(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const range = request.nextUrl.searchParams.get('range') || '7d'
  const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : null
  const since = days ? new Date(Date.now() - days * 86400000) : new Date(0)
  const targetCpc = Number(request.nextUrl.searchParams.get('cpc')) || 2.32

  const [retailerClicks, conversions, byNetworkRaw, byCampaignRaw, recent] = await Promise.all([
    prisma.clickEvent.count({ where: { event: 'RETAILER_CLICK', createdAt: { gte: since } } }),

    prisma.affiliateConversion.findMany({
      where: { createdAt: { gte: since } },
      select: { commission: true, status: true, clickId: true },
    }),

    prisma.$queryRaw<{ network: string; conversions: bigint; commission: number; approved: number }[]>`
      SELECT network,
             COUNT(*) as conversions,
             COALESCE(SUM(commission), 0) as commission,
             COALESCE(SUM(CASE WHEN status = 'approved' THEN commission ELSE 0 END), 0) as approved
      FROM "AffiliateConversion"
      WHERE "createdAt" >= ${since}
      GROUP BY network
      ORDER BY commission DESC
    `,

    prisma.$queryRaw<{ utm_campaign: string | null; conversions: bigint; commission: number }[]>`
      SELECT "utmCampaign" as utm_campaign,
             COUNT(*) as conversions,
             COALESCE(SUM(commission), 0) as commission
      FROM "AffiliateConversion"
      WHERE "createdAt" >= ${since}
      GROUP BY "utmCampaign"
      ORDER BY commission DESC
      LIMIT 30
    `,

    prisma.affiliateConversion.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        network: true, orderId: true, commission: true, saleAmount: true,
        currency: true, status: true, slug: true, utmCampaign: true,
        clickId: true, createdAt: true,
      },
    }),
  ])

  const totalCommission = conversions.reduce((s, c) => s + (c.commission || 0), 0)
  const approvedCommission = conversions
    .filter(c => c.status === 'approved')
    .reduce((s, c) => s + (c.commission || 0), 0)
  const pendingCommission = conversions
    .filter(c => c.status === 'pending')
    .reduce((s, c) => s + (c.commission || 0), 0)
  const attributedConversions = conversions.filter(c => c.clickId).length

  // EPC on approved-only (the conservative, bankable number) and on all
  // non-declined (the optimistic ceiling). Decision uses the approved figure.
  const epcApproved = retailerClicks > 0 ? approvedCommission / retailerClicks : 0
  const epcAll = retailerClicks > 0 ? totalCommission / retailerClicks : 0

  // Per-click margin vs the cost to acquire that click. Positive == profitable.
  const marginPerClick = epcApproved - targetCpc
  const roas = targetCpc > 0 ? epcApproved / targetCpc : 0

  // Honesty guardrail: with too few conversions the EPC is statistical noise.
  const confident = conversions.length >= 30
  const verdict =
    conversions.length === 0 ? 'NO_DATA' :
    !confident ? 'INSUFFICIENT_DATA' :
    marginPerClick >= 0 ? 'PROFITABLE' : 'UNPROFITABLE'

  const round = (n: number) => Math.round(n * 100) / 100

  return NextResponse.json({
    range,
    targetCpc,
    retailerClicks,
    conversions: {
      total: conversions.length,
      attributed: attributedConversions,        // joined to a click via sub-id
      unattributed: conversions.length - attributedConversions, // e.g. Amazon report imports
    },
    commission: {
      approvedUsd: round(approvedCommission),
      pendingUsd: round(pendingCommission),
      totalUsd: round(totalCommission),
    },
    epc: {
      approvedUsd: round(epcApproved),          // <-- the headline number
      allNonDeclinedUsd: round(epcAll),
    },
    decision: {
      targetCpcUsd: targetCpc,
      marginPerClickUsd: round(marginPerClick),
      roas: round(roas),
      verdict,                                  // NO_DATA | INSUFFICIENT_DATA | PROFITABLE | UNPROFITABLE
      unfreezeSpend: verdict === 'PROFITABLE',  // the gate: only true when proven profitable
    },
    byNetwork: byNetworkRaw.map(r => ({
      network: r.network,
      conversions: Number(r.conversions),
      commissionUsd: round(Number(r.commission)),
      approvedUsd: round(Number(r.approved)),
      epcUsd: retailerClicks > 0 ? round(Number(r.commission) / retailerClicks) : 0,
    })),
    byCampaign: byCampaignRaw.map(r => ({
      utmCampaign: r.utm_campaign || '(none)',
      conversions: Number(r.conversions),
      commissionUsd: round(Number(r.commission)),
    })),
    recent: recent.map(r => ({
      ...r,
      commission: round(r.commission || 0),
      saleAmount: r.saleAmount != null ? round(r.saleAmount) : null,
    })),
  })
}
