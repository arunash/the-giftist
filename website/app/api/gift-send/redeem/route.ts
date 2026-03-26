import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { smartWhatsAppSend } from '@/lib/notifications'
import { createTremendousReward } from '@/lib/tremendous'

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
  const { redeemCode, method } = await request.json()

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

  if (gift.status !== 'PAID' && gift.status !== 'NOTIFIED') {
    return NextResponse.json({ error: 'Gift is not redeemable', status: gift.status }, { status: 400 })
  }

  if (gift.redeemedAt) {
    return NextResponse.json({ error: 'Gift already redeemed' }, { status: 400 })
  }

  if (method === 'ITEM_CLICK') {
    // No auth required — recipient is clicking through to the retailer
    await prisma.giftSend.update({
      where: { id: gift.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redemptionMethod: 'ITEM_CLICK',
      },
    })

    // Notify sender
    if (gift.sender.phone) {
      smartWhatsAppSend(
        gift.sender.phone,
        `🎉 ${gift.recipientName || 'Your recipient'} just redeemed your gift "${gift.itemName}"!`,
        'gift_redeemed_sender',
        [gift.recipientName || 'Your recipient', gift.itemName]
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, method: 'ITEM_CLICK' })
  }

  if (method === 'WALLET') {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Login required to redeem to wallet' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Upsert wallet and add funds
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
        description: `Gift from ${gift.recipientName ? 'sender' : 'a friend'}: "${gift.itemName}"`,
      },
    })

    await prisma.giftSend.update({
      where: { id: gift.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redemptionMethod: 'WALLET',
        recipientUserId: userId,
      },
    })

    // Notify sender
    if (gift.sender.phone) {
      smartWhatsAppSend(
        gift.sender.phone,
        `🎉 ${gift.recipientName} just redeemed your gift "${gift.itemName}"!`,
        'gift_redeemed_sender',
        [gift.recipientName || 'Your recipient', gift.itemName]
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, method: 'WALLET', walletBalance: wallet.balance })
  }

  if (method === 'TREMENDOUS') {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Login required to redeem' }, { status: 401 })
    }
    const userId = (session.user as any).id

    try {
      const reward = await createTremendousReward({
        amount: gift.amount,
        recipientName: gift.recipientName || undefined,
        externalId: gift.id,
      })

      await prisma.giftSend.update({
        where: { id: gift.id },
        data: {
          status: 'REDEEMED',
          redeemedAt: new Date(),
          redemptionMethod: 'TREMENDOUS',
          recipientUserId: userId,
          tremendousRewardId: reward.rewardId,
          tremendousLink: reward.claimLink,
        },
      })

      // Notify sender
      if (gift.sender.phone) {
        smartWhatsAppSend(
          gift.sender.phone,
          `🎉 ${gift.recipientName || 'Your recipient'} just redeemed your gift "${gift.itemName}"!`,
          'gift_redeemed_sender',
          [gift.recipientName || 'Your recipient', gift.itemName]
        ).catch(() => {})
      }

      return NextResponse.json({ success: true, method: 'TREMENDOUS', claimLink: reward.claimLink })
    } catch (err) {
      console.error('[Redeem] Tremendous error:', err)
      return NextResponse.json({ error: 'Failed to create reward. Please try again.' }, { status: 500 })
    }
  }

  if (method === 'CASH_OUT') {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Login required to redeem' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Add to wallet first, then user can withdraw from wallet page
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
        description: `Gift from ${gift.sender.name || 'a friend'}: "${gift.itemName}" (pending withdrawal)`,
      },
    })

    await prisma.giftSend.update({
      where: { id: gift.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redemptionMethod: 'CASH_OUT',
        recipientUserId: userId,
      },
    })

    // Notify sender
    if (gift.sender.phone) {
      smartWhatsAppSend(
        gift.sender.phone,
        `🎉 ${gift.recipientName} just redeemed your gift "${gift.itemName}"!`,
        'gift_redeemed_sender',
        [gift.recipientName || 'Your recipient', gift.itemName]
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, method: 'CASH_OUT', walletBalance: wallet.balance })
  }

  return NextResponse.json({ error: 'Invalid method' }, { status: 400 })
}
