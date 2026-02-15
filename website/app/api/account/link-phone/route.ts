import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/whatsapp'
import { verifyCode } from '@/lib/verification-codes'
import { mergeUsers } from '@/lib/merge-users'
import { logError } from '@/lib/api-logger'

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

    if (!verifyCode(normalized, code)) {
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
      // Merge the phone user's data into the current user
      await mergeUsers(existingPhoneUser.id, currentUserId)
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
