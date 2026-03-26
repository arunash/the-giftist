import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

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
  const platformFee = Math.round(amount * 0.05 * 100) / 100
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
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  })

  const stripeSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Gift: ${itemName}`,
          description: `Send "${itemName}" to ${recipientName || 'your friend'}`,
        },
        unit_amount: Math.round(totalCharged * 100),
      },
      quantity: 1,
    }],
    metadata: {
      type: 'gift_send',
      giftSendId: giftSend.id,
      userId,
    },
    success_url: `${process.env.NEXTAUTH_URL || 'https://giftist.ai'}/gift/sent?id=${giftSend.id}`,
    cancel_url: `${process.env.NEXTAUTH_URL || 'https://giftist.ai'}/chat`,
  })

  await prisma.giftSend.update({
    where: { id: giftSend.id },
    data: { stripeSessionId: stripeSession.id },
  })

  return NextResponse.json({ checkoutUrl: stripeSession.url, giftSendId: giftSend.id })
}
