import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ADMIN_USER_IDS = new Set(['cmliwct6c00009zxu0g7rns32'])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !ADMIN_USER_IDS.has(session.user.id)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const monthAgo = new Date(now.getTime() - 30 * 86400000)

  // Get all message queue entries with stats
  const [
    queueStats,
    recentMessages,
    templateBreakdown,
    weeklyVolume,
    userEngagement,
  ] = await Promise.all([
    // Overall queue stats
    prisma.messageQueue.groupBy({
      by: ['status'],
      _count: true,
    }),

    // Recent messages (last 50)
    prisma.messageQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        userId: true,
        phone: true,
        email: true,
        subject: true,
        text: true,
        template: true,
        priority: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        expiresAt: true,
        dedupKey: true,
        createdAt: true,
        user: { select: { name: true, phone: true } },
      },
    }),

    // Breakdown by template (campaign type)
    prisma.messageQueue.groupBy({
      by: ['template'],
      where: { createdAt: { gte: monthAgo } },
      _count: true,
      orderBy: { _count: { template: 'desc' } },
    }),

    // Weekly send volume (sent messages in last 7 days)
    prisma.messageQueue.count({
      where: { status: 'SENT', sentAt: { gte: weekAgo } },
    }),

    // Users who received messages and then engaged (sent a WhatsApp message within 24h)
    // We approximate this by finding users who got a message and have activity after
    prisma.$queryRaw`
      SELECT
        mq.template,
        COUNT(DISTINCT mq."userId") as total_sent,
        COUNT(DISTINCT CASE
          WHEN wm."createdAt" > mq."sentAt"
          AND wm."createdAt" < mq."sentAt" + interval '48 hours'
          AND wm.type = 'text'
          THEN mq."userId"
        END) as engaged_users
      FROM "MessageQueue" mq
      LEFT JOIN "User" u ON u.id = mq."userId"
      LEFT JOIN "WhatsAppMessage" wm ON wm.phone = u.phone
        AND wm.status = 'RECEIVED'
        AND wm."createdAt" > mq."sentAt"
        AND wm."createdAt" < mq."sentAt" + interval '48 hours'
      WHERE mq.status = 'SENT'
        AND mq."sentAt" >= ${monthAgo}
      GROUP BY mq.template
      ORDER BY total_sent DESC
    ` as Promise<Array<{ template: string; total_sent: bigint; engaged_users: bigint }>>,
  ])

  // Format stats
  const stats = {
    queued: 0,
    sent: 0,
    skipped: 0,
  }
  for (const s of queueStats) {
    if (s.status === 'QUEUED') stats.queued = s._count
    else if (s.status === 'SENT') stats.sent = s._count
    else if (s.status === 'SKIPPED') stats.skipped = s._count
  }

  // Format engagement data
  const engagement = (userEngagement as Array<{ template: string; total_sent: bigint; engaged_users: bigint }>).map(e => ({
    template: e.template,
    totalSent: Number(e.total_sent),
    engagedUsers: Number(e.engaged_users),
    engagementRate: Number(e.total_sent) > 0
      ? Math.round((Number(e.engaged_users) / Number(e.total_sent)) * 100)
      : 0,
  }))

  // Format template breakdown
  const campaigns = templateBreakdown.map(t => ({
    template: t.template,
    count: t._count,
  }))

  return NextResponse.json({
    stats,
    weeklyVolume,
    campaigns,
    engagement,
    messages: recentMessages.map(m => ({
      id: m.id,
      userName: m.user?.name || 'Unknown',
      userPhone: m.user?.phone || m.phone || m.email,
      subject: m.subject,
      template: m.template,
      priority: m.priority,
      status: m.status,
      scheduledAt: m.scheduledAt,
      sentAt: m.sentAt,
      expiresAt: m.expiresAt,
      createdAt: m.createdAt,
      textPreview: m.text?.slice(0, 120) || '',
    })),
  })
}
