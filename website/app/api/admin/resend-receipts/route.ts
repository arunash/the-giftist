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

  const results: { id: string; status: string; error?: string }[] = []

  for (const c of contributions) {
    try {
      const owner = c.item?.user || c.event?.user
      if (!owner) {
        results.push({ id: c.id, status: 'skipped', error: 'no owner found' })
        continue
      }

      sendContributionReceipts({
        amount: c.amount,
        itemName: c.item?.name,
        eventName: c.event?.name,
        itemId: c.itemId,
        eventId: c.eventId,
        contributorName: c.contributor?.name || 'Someone',
        isAnonymous: c.isAnonymous,
        contributor: {
          email: c.contributorEmail || c.contributor?.email,
          phone: c.contributor?.phone,
        },
        owner: {
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
        },
      })

      results.push({ id: c.id, status: 'sent' })
    } catch (err: any) {
      results.push({ id: c.id, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ total: contributions.length, results })
}
