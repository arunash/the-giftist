import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

// Feeds the persistent Recent Gift Sends table at the top of the admin
// dashboard. Returns latest 15 gifts with sender/recipient/item/$/status.
export async function GET() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const recent = await prisma.giftSend.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: {
      sender: { select: { name: true } },
    },
  })

  return NextResponse.json({
    gifts: recent.map(g => ({
      id: g.id,
      sender: g.sender?.name || '—',
      recipient: g.recipientName || '—',
      itemName: g.itemName,
      totalCharged: g.totalCharged,
      platformFee: g.platformFee,
      status: g.status,
      createdAt: g.createdAt.toISOString(),
    })),
  })
}
