import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/whatsapp'
import twilio from 'twilio'
import { logApiCall, logError } from '@/lib/api-logger'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA4d084fd13308242b810892d8bf45f4a0'

// In-memory rate limiter: max 5 requests per phone per 15 minutes, max 10 per IP per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 15 * 60 * 1000
const MAX_PER_PHONE = 5
const MAX_PER_IP = 10

function checkRateLimit(key: string, max: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

// Clean up stale entries every 30 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 30 * 60 * 1000).unref?.()

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
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

    // Rate limit by IP and phone
    if (!checkRateLimit(`ip:${ip}`, MAX_PER_IP) || !checkRateLimit(`phone:${normalized}`, MAX_PER_PHONE)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      )
    }

    await twilioClient.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verifications.create({
        to: `+${normalized}`,
        channel: 'whatsapp',
      })

    logApiCall({ provider: 'TWILIO', endpoint: 'verify/send', source: 'AUTH' }).catch(() => {})

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
