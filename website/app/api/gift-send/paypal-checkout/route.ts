import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createPayPalOrder } from '@/lib/paypal'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const body = await request.json()
  const { recipientPhone, recipientName, itemName, itemPrice, itemUrl, itemImage, senderMessage } = body

  if (!recipientPhone || !itemName || !itemPrice || itemPrice <= 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const amount = Math.round(itemPrice * 100) / 100
  const platformFee = Math.round(amount * (amount >= 100 ? 0.10 : 0.15) * 100) / 100
  const totalCharged = Math.round((amount + platformFee) * 100) / 100

  const giftSend = await prisma.giftSend.create({
    data: {
      senderId: userId,
      recipientPhone: recipientPhone.replace(/\D/g, ''),
      recipientName: recipientName || null,
      itemName,
      itemPrice: amount,
      itemUrl: itemUrl || null,
      itemImage: itemImage || null,
      senderMessage: senderMessage || null,
      amount,
      platformFee,
      totalCharged,
      status: 'PENDING',
      redeemCode: crypto.randomBytes(16).toString('base64url'),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'

  try {
    const { orderId, approvalUrl } = await createPayPalOrder({
      amount: totalCharged,
      description: `Gift: ${itemName} for ${recipientName || 'a friend'}`,
      returnUrl: `${baseUrl}/api/gift-send/paypal-capture?orderId=${giftSend.id}`,
      cancelUrl: `${baseUrl}/chat`,
      customId: giftSend.id,
    })

    await prisma.giftSend.update({
      where: { id: giftSend.id },
      data: { paypalOrderId: orderId },
    })

    return NextResponse.json({ approvalUrl, giftSendId: giftSend.id })
  } catch (err) {
    console.error('[PayPal Checkout] Error:', err)
    // Clean up the pending gift
    await prisma.giftSend.delete({ where: { id: giftSend.id } })
    return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
  }
}
