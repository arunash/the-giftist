import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { sendTextMessage } from '@/lib/whatsapp'

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

  const results: { id: string; amount: number; ownerEmail: string | null; ownerPhone: string | null; emailResult?: string; whatsappResult?: string }[] = []

  for (const c of contributions) {
    const owner = c.item?.user || c.event?.user
    if (!owner) {
      results.push({ id: c.id, amount: c.amount, ownerEmail: null, ownerPhone: null, emailResult: 'skipped: no owner' })
      continue
    }

    const giftLabel = c.item?.name || c.event?.name || 'a gift'
    const displayName = c.isAnonymous ? 'Someone' : (c.contributor?.name || 'Someone')
    const entry: typeof results[number] = { id: c.id, amount: c.amount, ownerEmail: owner.email, ownerPhone: owner.phone }

    // Test email
    if (owner.email) {
      try {
        await sendEmail({
          to: owner.email,
          subject: `${displayName} contributed $${c.amount.toFixed(2)} toward ${giftLabel}`,
          html: `<p>${displayName} contributed <strong>$${c.amount.toFixed(2)}</strong> toward <strong>${giftLabel}</strong>.</p><p><a href="https://giftist.ai/wallet">View your funds</a></p>`,
        })
        entry.emailResult = 'ok'
      } catch (err: any) {
        entry.emailResult = `error: ${err.message}`
      }
    } else {
      entry.emailResult = 'skipped: no email'
    }

    // Test WhatsApp
    if (owner.phone) {
      try {
        await sendTextMessage(
          owner.phone,
          `🎁 ${displayName} contributed $${c.amount.toFixed(2)} toward "${giftLabel}"! View your funds: https://giftist.ai/wallet`
        )
        entry.whatsappResult = 'ok'
      } catch (err: any) {
        entry.whatsappResult = `error: ${err.message}`
      }
    } else {
      entry.whatsappResult = 'skipped: no phone'
    }

    results.push(entry)
  }

  return NextResponse.json({ total: contributions.length, results })
}
