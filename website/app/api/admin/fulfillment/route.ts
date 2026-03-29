import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { smartWhatsAppSend, emailWrapper } from '@/lib/notifications'
import { sendSms } from '@/lib/sms'
import { sendEmail } from '@/lib/email'

// GET: list gift orders — ?tab=all returns everything, default returns shipment orders only
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const tab = request.nextUrl.searchParams.get('tab')

  const where = tab === 'all'
    ? {}
    : { status: { in: ['REDEEMED_PENDING_SHIPMENT', 'SHIPPED', 'DELIVERED'] } }

  const orders = await prisma.giftSend.findMany({
    where,
    include: {
      sender: { select: { name: true, email: true } },
      recipient: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders.map(o => ({
    id: o.id,
    itemName: o.itemName,
    itemUrl: o.itemUrl,
    itemImage: o.itemImage,
    amount: o.amount,
    platformFee: o.platformFee,
    totalCharged: o.totalCharged,
    status: o.status,
    redemptionMethod: o.redemptionMethod,
    senderName: o.sender.name,
    recipientName: o.recipientName || o.recipient?.name || 'Unknown',
    recipientPhone: o.recipientPhone,
    recipientEmail: o.recipient?.email,
    shippingName: o.shippingName,
    shippingAddress: o.shippingAddress,
    shippingCity: o.shippingCity,
    shippingState: o.shippingState,
    shippingZip: o.shippingZip,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    redeemCode: o.redeemCode,
    fulfillmentCost: o.fulfillmentCost,
    createdAt: o.createdAt,
    redeemedAt: o.redeemedAt,
    shippedAt: o.shippedAt,
  })))
}

// POST: mark order as shipped + notify recipient
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { giftSendId, trackingNumber, trackingUrl, expectedDelivery, fulfillmentCost } = await request.json()

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

  const isAlreadyShipped = gift.status === 'SHIPPED' || gift.status === 'DELIVERED'

  await prisma.giftSend.update({
    where: { id: giftSendId },
    data: {
      status: 'SHIPPED',
      trackingNumber: trackingNumber || null,
      trackingUrl: trackingUrl || null,
      fulfillmentCost: typeof fulfillmentCost === 'number' ? fulfillmentCost : null,
      ...(!isAlreadyShipped && { shippedAt: new Date() }),
    },
  })

  // Only notify on first shipment, not edits
  if (isAlreadyShipped) {
    return NextResponse.json({ success: true })
  }

  // Notify recipient via all channels
  const senderName = gift.sender.name || 'A friend'
  const recipientPhone = gift.recipient?.phone || gift.recipientPhone
  const recipientEmail = gift.recipient?.email
  const deliveryLine = expectedDelivery
    ? `Expected delivery: ${new Date(expectedDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
    : ''
  const trackingLine = trackingUrl
    ? `Track your package: ${trackingUrl}`
    : trackingNumber
      ? `Tracking number: ${trackingNumber}`
      : ''

  // WhatsApp / SMS
  if (recipientPhone) {
    const text = [
      `Your gift "${gift.itemName}" from ${senderName} has shipped!`,
      deliveryLine,
      trackingLine,
    ].filter(Boolean).join('\n')

    smartWhatsAppSend(recipientPhone, text, 'gift_shipped', [gift.itemName, senderName], { skipTimeCheck: true })
      .catch((err) => {
        console.error('[Fulfillment] WhatsApp failed, trying SMS:', err)
        sendSms(recipientPhone!, text).catch(() => {})
      })
  }

  // Email
  if (recipientEmail) {
    const trackingHtml = trackingUrl
      ? `<a href="${trackingUrl}" style="color: #7c3aed; font-weight: 600;">Track your package</a>`
      : trackingNumber
        ? `Tracking number: <strong>${trackingNumber}</strong>`
        : ''
    const deliveryHtml = expectedDelivery
      ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Expected</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${new Date(expectedDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</td></tr>`
      : ''

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
            ${deliveryHtml}
          </table>
        </div>
        ${trackingHtml ? `<p style="margin: 0; font-size: 14px; color: #444;">${trackingHtml}</p>` : ''}
      `),
    }).catch((err) => console.error('[Fulfillment] Email failed:', err))
  }

  return NextResponse.json({ success: true })
}
