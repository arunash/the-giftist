import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { sendContributionReceipts } from '@/lib/receipts'

export async function POST() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const contributions = await prisma.contribution.findMany({
    where: { status: 'COMPLETED' },
    include: {
      item: { include: { user: { select: { name: true, email: true, phone: true } } } },
      event: { include: { user: { select: { name: true, email: true, phone: true } } } },
      contributor: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const results: { id: string; amount: number; result: string }[] = []

  for (let i = 0; i < contributions.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1500)) // avoid Resend rate limit
    const c = contributions[i]
    const owner = c.item?.user || c.event?.user
    if (!owner) {
      results.push({ id: c.id, amount: c.amount, result: 'skipped: no owner' })
      continue
    }

    try {
      const netAmount = c.amount - c.platformFeeAmount
      await sendContributionReceipts({
        amount: c.amount,
        itemName: c.item?.name || undefined,
        eventName: c.event?.name || undefined,
        itemId: c.itemId,
        eventId: c.eventId,
        contributorName: c.contributor?.name || 'Someone',
        isAnonymous: c.isAnonymous,
        contributor: {
          email: c.contributor?.email,
          phone: c.contributor?.phone,
        },
        owner: {
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
        },
        feeAmount: c.platformFeeAmount,
        netAmount,
        isFreeContribution: c.platformFeeAmount === 0,
        freeRemaining: 0,
      })
      results.push({ id: c.id, amount: c.amount, result: 'ok' })
    } catch (err: any) {
      results.push({ id: c.id, amount: c.amount, result: `error: ${err.message}` })
    }
  }

  return NextResponse.json({ total: contributions.length, results })
}
