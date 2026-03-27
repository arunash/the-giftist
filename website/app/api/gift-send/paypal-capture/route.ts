import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { capturePayPalOrder } from '@/lib/paypal'

export async function GET(request: NextRequest) {
  const giftSendId = request.nextUrl.searchParams.get('orderId')
  const paypalToken = request.nextUrl.searchParams.get('token') // PayPal adds this

  if (!giftSendId) {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  const gift = await prisma.giftSend.findUnique({ where: { id: giftSendId } })

  if (!gift || !gift.paypalOrderId) {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  // Already captured (user refreshed the page)
  if (gift.status === 'PAID') {
    return NextResponse.redirect(new URL(`/gift/sent?giftId=${gift.id}`, request.url))
  }

  try {
    const capture = await capturePayPalOrder(gift.paypalOrderId)

    if (capture.status === 'COMPLETED') {
      // Look up recipient by phone
      const recipientUser = gift.recipientPhone
        ? await prisma.user.findFirst({ where: { phone: gift.recipientPhone } })
        : null

      await prisma.giftSend.update({
        where: { id: gift.id },
        data: {
          status: 'PAID',
          paypalCaptureId: capture.captureId,
          recipientUserId: recipientUser?.id || null,
        },
      })

      // Send email receipt to sender
      const { sendGiftSendReceipt } = await import('@/lib/gift-notifications')
      sendGiftSendReceipt(gift.id).catch(() => {})

      return NextResponse.redirect(new URL(`/gift/sent?giftId=${gift.id}`, request.url))
    }

    // Payment not completed
    console.error('[PayPal Capture] Non-complete status:', capture.status)
    return NextResponse.redirect(new URL(`/gift/sent?giftId=${gift.id}&error=payment_failed`, request.url))
  } catch (err) {
    console.error('[PayPal Capture] Error:', err)
    return NextResponse.redirect(new URL(`/gift/sent?giftId=${gift.id}&error=capture_failed`, request.url))
  }
}
