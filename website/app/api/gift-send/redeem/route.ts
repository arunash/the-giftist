import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { smartWhatsAppSend } from '@/lib/notifications'
import { sendPayout } from '@/lib/paypal'
import { sendGiftRedemptionReceipt, cancelGiftReminders } from '@/lib/gift-notifications'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const gift = await prisma.giftSend.findUnique({
    where: { redeemCode: code },
    include: {
      sender: { select: { name: true } },
    },
  })

  if (!gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
  }

  // Show last 4 digits of recipient phone as hint
  const phoneDigits = (gift.recipientPhone || '').replace(/\D/g, '')
  const phoneLast4 = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : null

  return NextResponse.json({
    id: gift.id,
    senderName: gift.sender.name || 'A friend',
    recipientName: gift.recipientName,
    itemName: gift.itemName,
    itemPrice: gift.itemPrice,
    itemUrl: gift.itemUrl,
    itemImage: gift.itemImage,
    senderMessage: gift.senderMessage,
    amount: gift.amount,
    status: gift.status,
    redeemCode: gift.redeemCode,
    redeemedAt: gift.redeemedAt,
    phoneLast4,
  })
}

export async function POST(request: NextRequest) {
  const { redeemCode, method, paypalEmail, venmoPhone, shippingName, shippingAddress, shippingCity, shippingState, shippingZip } = await request.json()

  if (!redeemCode || !method) {
    return NextResponse.json({ error: 'Missing redeemCode or method' }, { status: 400 })
  }

  const gift = await prisma.giftSend.findUnique({
    where: { redeemCode },
    include: { sender: { select: { name: true, phone: true } } },
  })

  if (!gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
  }

  // Allow retry for REDEEMED_PENDING_REWARD (payout failed after claim)
  const isRetry = gift.status === 'REDEEMED_PENDING_REWARD' && (method === 'PAYPAL' || method === 'VENMO')

  if (!isRetry) {
    if (gift.status !== 'PAID' && gift.status !== 'NOTIFIED') {
      return NextResponse.json({ error: 'Gift is not redeemable', status: gift.status }, { status: 400 })
    }

    if (gift.redeemedAt) {
      return NextResponse.json({ error: 'Gift already redeemed' }, { status: 400 })
    }
  }

  if (method === 'ITEM_CLICK') {
    // No auth required — recipient is clicking through to the retailer
    // Atomic update — only succeeds if redeemedAt is still null (prevents race condition)
    const updated = await prisma.giftSend.updateMany({
      where: { id: gift.id, redeemedAt: null },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redemptionMethod: 'ITEM_CLICK',
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Gift already redeemed' }, { status: 400 })
    }

    // Notify sender + send receipts
    if (gift.sender.phone) {
      smartWhatsAppSend(
        gift.sender.phone,
        `🎉 ${gift.recipientName || 'Your recipient'} just redeemed your gift "${gift.itemName}"!`,
        'gift_redeemed_sender',
        [gift.recipientName || 'Your recipient', gift.itemName]
      ).catch(() => {})
    }
    sendGiftRedemptionReceipt(gift.id, 'ITEM_CLICK').catch(() => {})
    cancelGiftReminders(gift.id).catch(() => {})

    return NextResponse.json({ success: true, method: 'ITEM_CLICK' })
  }

  if (method === 'PAYPAL' || method === 'VENMO') {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Login required to redeem' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const receiver = method === 'VENMO' ? venmoPhone : paypalEmail
    if (!receiver) {
      return NextResponse.json({ error: `Missing ${method === 'VENMO' ? 'Venmo phone number' : 'PayPal email'}` }, { status: 400 })
    }

    // On retry, gift is already claimed — skip atomic update
    if (!isRetry) {
      const updated = await prisma.giftSend.updateMany({
        where: { id: gift.id, redeemedAt: null },
        data: {
          status: 'REDEEMED',
          redeemedAt: new Date(),
          redemptionMethod: method,
        },
      })
      if (updated.count === 0) {
        return NextResponse.json({ error: 'Gift already redeemed' }, { status: 400 })
      }

      await prisma.giftSend.update({
        where: { id: gift.id },
        data: { recipientUserId: userId },
      })
    }

    try {
      // Deduct $0.25 PayPal payout fee from recipient amount
      const PAYOUT_FEE = 0.25
      const payoutAmount = Math.round((gift.amount - PAYOUT_FEE) * 100) / 100

      const result = await sendPayout({
        recipientType: method === 'VENMO' ? 'PHONE' : 'EMAIL',
        receiver: method === 'VENMO' ? receiver.replace(/\D/g, '') : receiver,
        amount: payoutAmount,
        recipientWallet: method === 'VENMO' ? 'VENMO' : 'PAYPAL',
        note: `Gift from ${gift.sender.name || 'a friend'}: "${gift.itemName}"`,
        senderBatchId: `giftist_gift_${gift.id}_${Date.now()}`,
      })

      // Store payout batch ID + mark REDEEMED (handles retry from REDEEMED_PENDING_REWARD)
      await prisma.giftSend.update({
        where: { id: gift.id },
        data: { paypalPayoutBatchId: result.payoutBatchId, status: 'REDEEMED' },
      })

      // Notify sender + send receipts
      if (gift.sender.phone) {
        smartWhatsAppSend(
          gift.sender.phone,
          `🎉 ${gift.recipientName || 'Your recipient'} just redeemed your gift "${gift.itemName}"!`,
          'gift_redeemed_sender',
          [gift.recipientName || 'Your recipient', gift.itemName]
        ).catch(() => {})
      }
      sendGiftRedemptionReceipt(gift.id, method, payoutAmount).catch(() => {})
      cancelGiftReminders(gift.id).catch(() => {})

      return NextResponse.json({
        success: true,
        method,
        payoutBatchId: result.payoutBatchId,
      })
    } catch (err) {
      console.error(`[Redeem] ${method} payout error:`, err)
      await prisma.giftSend.update({
        where: { id: gift.id },
        data: { status: 'REDEEMED_PENDING_REWARD' },
      })
      return NextResponse.json({ error: 'Failed to send payout. Please try again.' }, { status: 500 })
    }
  }

  if (method === 'WALLET') {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Login required to redeem' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const updated = await prisma.giftSend.updateMany({
      where: { id: gift.id, redeemedAt: null },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redemptionMethod: 'WALLET',
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Gift already redeemed' }, { status: 400 })
    }

    // Deposit full amount to recipient's wallet (no payout fee)
    await prisma.giftSend.update({
      where: { id: gift.id },
      data: { recipientUserId: userId },
    })

    const wallet = await prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: gift.amount },
      update: { balance: { increment: gift.amount } },
    })

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'GIFT_RECEIVED',
        amount: gift.amount,
        status: 'COMPLETED',
        description: `Gift from ${gift.sender.name || 'a friend'}: "${gift.itemName}"`,
      },
    })

    // Notify sender + send receipts
    if (gift.sender.phone) {
      smartWhatsAppSend(
        gift.sender.phone,
        `🎉 ${gift.recipientName || 'Your recipient'} just redeemed your gift "${gift.itemName}"!`,
        'gift_redeemed_sender',
        [gift.recipientName || 'Your recipient', gift.itemName]
      ).catch(() => {})
    }
    sendGiftRedemptionReceipt(gift.id, 'WALLET').catch(() => {})
    cancelGiftReminders(gift.id).catch(() => {})

    return NextResponse.json({ success: true, method: 'WALLET' })
  }

  if (method === 'SHIP') {
    if (!shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingZip) {
      return NextResponse.json({ error: 'Missing shipping address' }, { status: 400 })
    }

    const updated = await prisma.giftSend.updateMany({
      where: { id: gift.id, redeemedAt: null },
      data: {
        status: 'REDEEMED_PENDING_SHIPMENT',
        redeemedAt: new Date(),
        redemptionMethod: 'SHIP',
        shippingName,
        shippingAddress,
        shippingCity,
        shippingState,
        shippingZip,
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Gift already redeemed' }, { status: 400 })
    }

    // Notify sender
    if (gift.sender.phone) {
      smartWhatsAppSend(
        gift.sender.phone,
        `🎉 ${gift.recipientName || 'Your recipient'} just redeemed your gift "${gift.itemName}" and chose to have it shipped!`,
        'gift_redeemed_sender',
        [gift.recipientName || 'Your recipient', gift.itemName]
      ).catch(() => {})
    }
    sendGiftRedemptionReceipt(gift.id, 'SHIP').catch(() => {})
    cancelGiftReminders(gift.id).catch(() => {})

    // Notify admin (you) to fulfill
    const { sendEmail } = await import('@/lib/email')
    sendEmail({
      to: 'arunash@gmail.com',
      subject: `🚚 Gift needs shipping: ${gift.itemName}`,
      html: `<h2>New shipping request</h2>
        <p><b>Item:</b> ${gift.itemName}</p>
        <p><b>Item URL:</b> <a href="${gift.itemUrl}">${gift.itemUrl}</a></p>
        <p><b>Amount available:</b> $${gift.amount.toFixed(2)}</p>
        <p><b>Ship to:</b><br>${shippingName}<br>${shippingAddress}<br>${shippingCity}, ${shippingState} ${shippingZip}</p>
        <p><b>Gift ID:</b> ${gift.id}</p>`,
    }).catch(() => {})

    return NextResponse.json({ success: true, method: 'SHIP' })
  }

  return NextResponse.json({ error: 'Invalid method' }, { status: 400 })
}
