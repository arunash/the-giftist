import { NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/whatsapp'
import twilio from 'twilio'
import { logError } from '@/lib/api-logger'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA4d084fd13308242b810892d8bf45f4a0'

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

    await twilioClient.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verifications.create({
        to: `+${normalized}`,
        channel: 'whatsapp',
      })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to send verification code:', error?.message, error?.code, error?.status, error?.moreInfo)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack, metadata: { code: error?.code, moreInfo: error?.moreInfo } }).catch(() => {})

    if (error?.code === 60203) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait 5 minutes before trying again.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Failed to send verification code. Please try again.' },
      { status: 500 }
    )
  }
}
