import { prisma } from '@/lib/db'
import { daysUntil, formatPrice } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

export interface DigestEvent {
  name: string
  date: Date
  daysAway: number
  itemCount: number
}

export interface DigestFundingItem {
  name: string
  percentFunded: number
  remaining: number
}

export interface DigestNewItem {
  name: string
  price: string | null
}

export interface DigestData {
  userName: string
  upcomingEvents: DigestEvent[]
  fundingProgress: DigestFundingItem[]
  almostFunded: DigestFundingItem[]
  newItems: DigestNewItem[]
  stats: {
    totalItems: number
    totalContributions: number
    newActivityCount: number
  }
}

// ─── Data Generation ─────────────────────────────────────────────────

export async function generateDigestData(userId: string): Promise<DigestData | null> {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  if (!user) return null

  // Upcoming events within 30 days
  const events = await prisma.event.findMany({
    where: { userId, date: { gte: now, lte: thirtyDaysFromNow } },
    include: { _count: { select: { items: true } } },
    orderBy: { date: 'asc' },
  })

  const upcomingEvents: DigestEvent[] = events.map((e) => ({
    name: e.name,
    date: e.date,
    daysAway: daysUntil(e.date),
    itemCount: e._count.items,
  }))

  // Items with contributions this week
  const recentContributions = await prisma.contribution.findMany({
    where: { item: { userId }, createdAt: { gte: oneWeekAgo }, status: 'COMPLETED' },
    include: { item: true },
  })

  const fundedItemMap = new Map<string, { name: string; goalAmount: number; fundedAmount: number }>()
  for (const c of recentContributions) {
    if (!c.item) continue
    if (!fundedItemMap.has(c.item.id)) {
      fundedItemMap.set(c.item.id, {
        name: c.item.name,
        goalAmount: c.item.goalAmount || 0,
        fundedAmount: c.item.fundedAmount,
      })
    }
  }

  const fundingProgress: DigestFundingItem[] = Array.from(fundedItemMap.values())
    .filter((i) => i.goalAmount > 0)
    .map((i) => ({
      name: i.name,
      percentFunded: Math.min(100, Math.round((i.fundedAmount / i.goalAmount) * 100)),
      remaining: Math.max(0, i.goalAmount - i.fundedAmount),
    }))

  // Almost funded — items within $50 of goal (regardless of recency)
  const almostFundedItems = await prisma.item.findMany({
    where: {
      userId,
      goalAmount: { gt: 0 },
      isPurchased: false,
    },
  })

  const almostFunded: DigestFundingItem[] = almostFundedItems
    .filter((i) => i.goalAmount! - i.fundedAmount > 0 && i.goalAmount! - i.fundedAmount <= 50)
    .map((i) => ({
      name: i.name,
      percentFunded: Math.min(100, Math.round((i.fundedAmount / i.goalAmount!) * 100)),
      remaining: i.goalAmount! - i.fundedAmount,
    }))

  // New items added this week
  const recentItems = await prisma.item.findMany({
    where: { userId, addedAt: { gte: oneWeekAgo } },
    orderBy: { addedAt: 'desc' },
    take: 10,
  })

  const newItems: DigestNewItem[] = recentItems.map((i) => ({
    name: i.name,
    price: i.price,
  }))

  // Stats
  const totalItems = await prisma.item.count({ where: { userId } })

  const contributionAgg = await prisma.contribution.aggregate({
    where: { item: { userId }, status: 'COMPLETED' },
    _sum: { amount: true },
  })

  const newActivityCount = await prisma.activityEvent.count({
    where: { userId, createdAt: { gte: oneWeekAgo } },
  })

  const data: DigestData = {
    userName: user.name || 'there',
    upcomingEvents,
    fundingProgress,
    almostFunded,
    newItems,
    stats: {
      totalItems,
      totalContributions: contributionAgg._sum.amount || 0,
      newActivityCount,
    },
  }

  // Skip if there's nothing meaningful to report
  const hasContent =
    upcomingEvents.length > 0 ||
    fundingProgress.length > 0 ||
    almostFunded.length > 0 ||
    newItems.length > 0 ||
    newActivityCount > 0
  if (!hasContent) return null

  return data
}

// ─── Email HTML ──────────────────────────────────────────────────────

export function formatDigestEmail(data: DigestData): string {
  const sections: string[] = []

  if (data.upcomingEvents.length > 0) {
    const rows = data.upcomingEvents
      .map(
        (e) =>
          `<tr><td style="padding:6px 0;color:#333">${e.name}</td><td style="padding:6px 12px;color:#666">${e.daysAway} day${e.daysAway !== 1 ? 's' : ''} away</td><td style="padding:6px 0;color:#888">${e.itemCount} item${e.itemCount !== 1 ? 's' : ''}</td></tr>`
      )
      .join('')
    sections.push(`
      <h2 style="color:#333;font-size:18px;margin:24px 0 8px">📅 Upcoming Events</h2>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    `)
  }

  if (data.fundingProgress.length > 0) {
    const items = data.fundingProgress
      .map(
        (i) => `
        <div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#333">${i.name}</span>
            <span style="color:#666">${i.percentFunded}% funded (${formatPrice(i.remaining)} left)</span>
          </div>
          <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden">
            <div style="background:#22c55e;height:100%;width:${i.percentFunded}%;border-radius:4px"></div>
          </div>
        </div>`
      )
      .join('')
    sections.push(`
      <h2 style="color:#333;font-size:18px;margin:24px 0 8px">💰 Funding Progress</h2>
      ${items}
    `)
  }

  if (data.almostFunded.length > 0) {
    const items = data.almostFunded
      .map(
        (i) =>
          `<div style="margin:4px 0;color:#333">🎯 <strong>${i.name}</strong> — ${i.percentFunded}% funded, only ${formatPrice(i.remaining)} to go!</div>`
      )
      .join('')
    sections.push(`
      <h2 style="color:#333;font-size:18px;margin:24px 0 8px">🎯 Almost Funded</h2>
      ${items}
    `)
  }

  if (data.newItems.length > 0) {
    const items = data.newItems
      .map(
        (i) =>
          `<div style="margin:4px 0;color:#333">• ${i.name}${i.price ? ` (${i.price})` : ''}</div>`
      )
      .join('')
    sections.push(`
      <h2 style="color:#333;font-size:18px;margin:24px 0 8px">🆕 New Saves This Week</h2>
      ${items}
    `)
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px">
    <div style="background:#16a34a;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">🎁 Giftist</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#333;font-size:16px;margin-top:0">Hi ${data.userName}, here's your weekly Giftist update!</p>
      ${sections.join('')}
      <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px;text-align:center;color:#666;font-size:14px">
        📊 ${data.stats.totalItems} items · ${formatPrice(data.stats.totalContributions)} contributed · ${data.stats.newActivityCount} new activit${data.stats.newActivityCount !== 1 ? 'ies' : 'y'}
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://giftist.ai" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:16px">Visit Your Wishlist</a>
      </div>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#999">
      <p style="margin:0">You're receiving this because you have a Giftist account.</p>
      <p style="margin:4px 0 0"><a href="https://giftist.ai/settings" style="color:#999;text-decoration:underline">Unsubscribe from weekly digests</a></p>
    </div>
  </div>
</body>
</html>`
}

// ─── WhatsApp Text ───────────────────────────────────────────────────

export function formatDigestWhatsApp(data: DigestData): string {
  const lines: string[] = [
    `Hi ${data.userName}! Here's your weekly Giftist update:`,
    '',
  ]

  if (data.upcomingEvents.length > 0) {
    lines.push('📅 *Upcoming Events*')
    for (const e of data.upcomingEvents) {
      lines.push(`• ${e.name} — ${e.daysAway} day${e.daysAway !== 1 ? 's' : ''} (${e.itemCount} item${e.itemCount !== 1 ? 's' : ''})`)
    }
    lines.push('')
  }

  if (data.fundingProgress.length > 0) {
    lines.push('💰 *Funding Progress*')
    for (const i of data.fundingProgress) {
      lines.push(`• ${i.name} — ${i.percentFunded}% funded (${formatPrice(i.remaining)} left)`)
    }
    lines.push('')
  }

  if (data.almostFunded.length > 0) {
    lines.push('🎯 *Almost Funded*')
    for (const i of data.almostFunded) {
      lines.push(`• ${i.name} — ${i.percentFunded}% funded, only ${formatPrice(i.remaining)} to go!`)
    }
    lines.push('')
  }

  if (data.newItems.length > 0) {
    lines.push('🆕 *New Saves This Week*')
    for (const i of data.newItems) {
      lines.push(`• ${i.name}${i.price ? ` (${i.price})` : ''}`)
    }
    lines.push('')
  }

  lines.push(`📊 ${data.stats.totalItems} items · ${formatPrice(data.stats.totalContributions)} contributed · ${data.stats.newActivityCount} new activit${data.stats.newActivityCount !== 1 ? 'ies' : 'y'}`)
  lines.push('')
  lines.push('Visit giftist.ai for your full wishlist!')

  return lines.join('\n')
}
