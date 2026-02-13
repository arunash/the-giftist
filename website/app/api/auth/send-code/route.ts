import { NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/whatsapp'
import { sendTextMessage } from '@/lib/whatsapp'
import { generateCode } from '@/lib/verification-codes'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const normalized = normalizePhone(phone)

    if (normalized.length < 10) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      )
    }

    const result = generateCode(normalized)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 429 })
    }

    await sendTextMessage(
      normalized,
      `Your Giftist code: *${result.code}*\nExpires in 5 minutes.`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to send verification code:', error)
    return NextResponse.json(
      { error: 'Failed to send verification code. Please try again.' },
      { status: 500 }
    )
  }
}
