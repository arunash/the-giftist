import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

// Tiny admin endpoint feeding the persistent "Today's gifts" strip
// on the admin dashboard. Same metrics as the daily email digest, just
// served live for the in-app view.
export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const since = new Date(Date.now() - 24 * 3600 * 1000)
  const weekSince = new Date(Date.now() - 7 * 86400 * 1000)

  const [newToday, redeemedToday, pendingShipment, stuck, revenue7d] = await Promise.all([
    prisma.giftSend.count({ where: { createdAt: { gte: since } } }),
    prisma.giftSend.count({ where: { redeemedAt: { gte: since } } }),
    prisma.giftSend.count({ where: { status: 'REDEEMED_PENDING_SHIPMENT' } }),
    prisma.giftSend.count({
      where: {
        status: { in: ['PAID', 'NOTIFIED'] },
        redeemedAt: null,
        createdAt: { lt: since, gte: weekSince },
      },
    }),
    prisma.giftSend.aggregate({
      where: { createdAt: { gte: weekSince } },
      _sum: { totalCharged: true },
    }),
  ])

  return NextResponse.json({
    newToday,
    redeemedToday,
    pendingShipment,
    stuck,
    revenue7d: revenue7d._sum.totalCharged || 0,
  })
}
