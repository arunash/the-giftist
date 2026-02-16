import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/whatsapp'
import { logError } from '@/lib/api-logger'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)
function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`${name} environment variable is required`)
  return val
}
const VERIFY_SERVICE_SID = requireEnv('TWILIO_VERIFY_SERVICE_SID')

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentUserId = (session.user as any).id

  try {
    const { phone, code } = await request.json()

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Phone and code are required' },
        { status: 400 }
      )
    }

    const normalized = normalizePhone(phone)

    // Verify code via Twilio Verify
    try {
      const check = await twilioClient.verify.v2
        .services(VERIFY_SERVICE_SID)
        .verificationChecks.create({
          to: `+${normalized}`,
          code,
        })

      if (check.status !== 'approved') {
        return NextResponse.json(
          { error: 'Invalid or expired verification code' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      )
    }

    // Check if phone belongs to a different user
    const existingPhoneUser = await prisma.user.findUnique({
      where: { phone: normalized },
    })

    if (existingPhoneUser && existingPhoneUser.id !== currentUserId) {
      // Check if the existing account has real data (items, events, messages)
      const [itemCount, eventCount] = await Promise.all([
        prisma.item.count({ where: { userId: existingPhoneUser.id } }),
        prisma.event.count({ where: { userId: existingPhoneUser.id } }),
      ])

      if (itemCount > 0 || eventCount > 0) {
        // Don't silently merge accounts with real data — require explicit confirmation
        return NextResponse.json(
          {
            error: 'phone_in_use',
            message: 'This phone number is linked to another account with existing data. Please contact support to merge accounts.',
          },
          { status: 409 }
        )
      }

      // Empty account (e.g., auto-created by WhatsApp bot) — safe to merge
      await prisma.chatMessage.updateMany({ where: { userId: existingPhoneUser.id }, data: { userId: currentUserId } })
      await prisma.user.delete({ where: { id: existingPhoneUser.id } })
    }

    // Set phone on current user
    await prisma.user.update({
      where: { id: currentUserId },
      data: { phone: normalized },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to link phone:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to link phone number' },
      { status: 500 }
    )
  }
}
