import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { smartWhatsAppSend } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { redeemCode, message } = await request.json()

  if (!redeemCode || !message) {
    return NextResponse.json({ error: 'Missing redeemCode or message' }, { status: 400 })
  }

  const gift = await prisma.giftSend.findUnique({
    where: { redeemCode },
    include: {
      sender: { select: { name: true, phone: true } },
    },
  })

  if (!gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
  }

  if (!gift.redeemedAt) {
    return NextResponse.json({ error: 'Gift has not been redeemed yet' }, { status: 400 })
  }

  // Send WhatsApp to sender
  if (gift.sender.phone) {
    const recipientName = gift.recipientName || session.user.name || 'Someone'
    const text = `💌 ${recipientName} sent you a thank-you for '${gift.itemName}': "${message}"`

    await smartWhatsAppSend(
      gift.sender.phone,
      text,
      'gift_thank_you',
      [recipientName, gift.itemName, message],
      { skipTimeCheck: true }
    ).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
