import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { emailWrapper } from '@/lib/notifications'

const ADMIN_EMAILS = ['arunash@gmail.com']

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !ADMIN_EMAILS.includes((session.user as any).email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { giftSendId, trackingNumber, trackingUrl } = await request.json()

  if (!giftSendId) {
    return NextResponse.json({ error: 'Missing giftSendId' }, { status: 400 })
  }

  const gift = await prisma.giftSend.findUnique({
    where: { id: giftSendId },
    include: {
      sender: { select: { name: true } },
      recipient: { select: { email: true, phone: true } },
    },
  })

  if (!gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
  }

  if (gift.status !== 'REDEEMED_PENDING_SHIPMENT') {
    return NextResponse.json({ error: 'Gift is not pending shipment' }, { status: 400 })
  }

  await prisma.giftSend.update({
    where: { id: giftSendId },
    data: {
      status: 'SHIPPED',
      trackingNumber: trackingNumber || null,
      trackingUrl: trackingUrl || null,
      shippedAt: new Date(),
    },
  })

  // Email tracking info to recipient
  const recipientEmail = gift.recipient?.email
  if (recipientEmail) {
    const senderName = gift.sender.name || 'A friend'
    const trackingLine = trackingUrl
      ? `<a href="${trackingUrl}" style="color: #7c3aed; font-weight: 600;">Track your package</a>`
      : trackingNumber
        ? `Tracking number: <strong>${trackingNumber}</strong>`
        : 'We\'ll update you when it arrives.'

    sendEmail({
      to: recipientEmail,
      subject: `Your gift is on its way! — ${gift.itemName}`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Your gift has shipped!</p>
        <div style="background: #f0fdf4; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534; width: 100px;">Gift</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${gift.itemName}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">From</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${senderName}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Ship to</td><td style="padding: 4px 0; font-size: 13px; color: #444;">${gift.shippingName}<br>${gift.shippingAddress}<br>${gift.shippingCity}, ${gift.shippingState} ${gift.shippingZip}</td></tr>
          </table>
        </div>
        <p style="margin: 0; font-size: 14px; color: #444;">${trackingLine}</p>
      `),
    }).catch((err) => console.error('[Ship] Email failed:', err))
  }

  return NextResponse.json({ success: true })
}
