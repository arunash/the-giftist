import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { smartWhatsAppSend, emailWrapper } from '@/lib/notifications'
import { sendSms } from '@/lib/sms'
import { sendEmail } from '@/lib/email'
import { normalizePhone } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { giftSendId } = await request.json()

  if (!giftSendId) {
    return NextResponse.json({ error: 'Missing giftSendId' }, { status: 400 })
  }

  const gift = await prisma.giftSend.findUnique({
    where: { id: giftSendId },
    include: {
      sender: { select: { name: true } },
      recipient: { select: { email: true, phone: true, name: true } },
    },
  })

  if (!gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
  }

  if (gift.status !== 'SHIPPED' && gift.status !== 'DELIVERED') {
    return NextResponse.json({ error: 'Gift has not been shipped yet' }, { status: 400 })
  }

  const senderName = gift.sender.name || 'A friend'
  const rawPhone = gift.recipient?.phone || gift.recipientPhone
  const recipientPhone = rawPhone ? normalizePhone(rawPhone) : null
  const recipientEmail = gift.recipient?.email
  const trackingLine = gift.trackingUrl
    ? `Track your package: ${gift.trackingUrl}`
    : gift.trackingNumber
      ? `Tracking number: ${gift.trackingNumber}`
      : ''

  let sent = { whatsapp: false, sms: false, email: false }

  // WhatsApp / SMS
  if (recipientPhone) {
    const text = [
      `Your gift "${gift.itemName}" from ${senderName} has shipped!`,
      trackingLine,
    ].filter(Boolean).join('\n')

    try {
      await smartWhatsAppSend(recipientPhone, text, 'gift_shipped', [gift.itemName, senderName], { skipTimeCheck: true })
      sent.whatsapp = true
    } catch (err: any) {
      console.error('[Resend] WhatsApp failed, trying SMS:', err?.message || err)
      try {
        await sendSms(recipientPhone, text)
        sent.sms = true
      } catch (smsErr: any) {
        console.error('[Resend] SMS also failed:', smsErr?.message || smsErr)
      }
    }
  }

  // Email
  if (recipientEmail) {
    const trackingHtml = gift.trackingUrl
      ? `<a href="${gift.trackingUrl}" style="color: #7c3aed; font-weight: 600;">Track your package</a>`
      : gift.trackingNumber
        ? `Tracking number: <strong>${gift.trackingNumber}</strong>`
        : ''

    try {
      await sendEmail({
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
          ${trackingHtml ? `<p style="margin: 0; font-size: 14px; color: #444;">${trackingHtml}</p>` : ''}
        `),
      })
      sent.email = true
    } catch (err) {
      console.error('[Resend] Email failed:', err)
    }
  }

  return NextResponse.json({ success: true, sent })
}
