import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const gift = await prisma.giftSend.findFirst({
    where: { id: params.id, senderId: userId },
    select: {
      id: true,
      recipientName: true,
      recipientPhone: true,
      itemName: true,
      itemPrice: true,
      itemImage: true,
      amount: true,
      platformFee: true,
      totalCharged: true,
      senderMessage: true,
      status: true,
      redeemCode: true,
      createdAt: true,
    },
  })

  if (!gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
  }

  return NextResponse.json(gift)
}
