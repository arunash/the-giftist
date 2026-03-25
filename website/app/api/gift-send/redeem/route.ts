import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
  })
}

export async function POST(request: NextRequest) {
  const { redeemCode, method } = await request.json()

  if (!redeemCode || !method) {
    return NextResponse.json({ error: 'Missing redeemCode or method' }, { status: 400 })
  }

  const gift = await prisma.giftSend.findUnique({
    where: { redeemCode },
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

    return NextResponse.json({ success: true, method: 'WALLET', walletBalance: wallet.balance })
  }

  if (method === 'ITEM_CLICK') {
    await prisma.giftSend.update({
      where: { id: gift.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redemptionMethod: 'ITEM_CLICK',
      },
    })

    return NextResponse.json({ success: true, method: 'ITEM_CLICK', itemUrl: gift.itemUrl })
  }

  return NextResponse.json({ error: 'Invalid method' }, { status: 400 })
}
