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
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA4d084fd13308242b810892d8bf45f4a0'

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
      // Merge the phone user's items/events into the current user, then delete the old user
      await prisma.item.updateMany({ where: { userId: existingPhoneUser.id }, data: { userId: currentUserId } })
      await prisma.event.updateMany({ where: { userId: existingPhoneUser.id }, data: { userId: currentUserId } })
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
