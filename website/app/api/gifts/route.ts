import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const userPhone = (session.user as any).phone

  // Gifts I sent
  const sent = await prisma.giftSend.findMany({
    where: { senderId: userId },
    select: {
      id: true,
      itemName: true,
      itemImage: true,
      itemUrl: true,
      amount: true,
      status: true,
      recipientName: true,
      recipientPhone: true,
      senderMessage: true,
      redeemCode: true,
      createdAt: true,
      redeemedAt: true,
      shippedAt: true,
      trackingUrl: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Gifts I received (matched by recipientUserId or recipientPhone)
  const receivedWhere = userPhone
    ? { OR: [{ recipientUserId: userId }, { recipientPhone: userPhone }] }
    : { recipientUserId: userId }

  const received = await prisma.giftSend.findMany({
    where: {
      ...receivedWhere,
      status: { notIn: ['PENDING'] }, // Only show paid/notified/redeemed gifts
    } as any,
    select: {
      id: true,
      itemName: true,
      itemImage: true,
      itemUrl: true,
      amount: true,
      status: true,
      senderMessage: true,
      redeemCode: true,
      createdAt: true,
      redeemedAt: true,
      shippedAt: true,
      trackingUrl: true,
      sender: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    sent: sent.map(g => ({
      ...g,
      direction: 'sent' as const,
    })),
    received: received.map(g => ({
      ...g,
      senderName: g.sender?.name || 'Someone',
      direction: 'received' as const,
    })),
  })
}
