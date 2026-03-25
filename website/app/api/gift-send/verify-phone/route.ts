import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { redeemCode, phone } = await request.json()

  if (!redeemCode || !phone) {
    return NextResponse.json({ error: 'Missing redeemCode or phone' }, { status: 400 })
  }

  const gift = await prisma.giftSend.findUnique({
    where: { redeemCode },
    select: { recipientPhone: true },
  })

  if (!gift) {
    return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
  }

  // Normalize both phone numbers to digits only for comparison
  const inputDigits = phone.replace(/\D/g, '')
  const storedDigits = (gift.recipientPhone || '').replace(/\D/g, '')

  if (!storedDigits) {
    // No phone stored — allow through (legacy gifts without phone requirement)
    return NextResponse.json({ verified: true })
  }

  // Match last 10 digits (handles +1 country code variations)
  const inputLast10 = inputDigits.slice(-10)
  const storedLast10 = storedDigits.slice(-10)

  if (inputLast10 === storedLast10 && inputLast10.length === 10) {
    return NextResponse.json({ verified: true })
  }

  return NextResponse.json({
    verified: false,
    error: 'Phone number does not match the recipient on file.',
  })
}
