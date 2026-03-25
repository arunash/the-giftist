import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { FriendProfile } from '@/lib/chat-analysis'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { circleMemberId, profile, friendName, phone } = await request.json() as {
    circleMemberId?: string
    profile: FriendProfile
    friendName?: string
    phone?: string
  }

  if (!profile) {
    return NextResponse.json({ error: 'Profile is required' }, { status: 400 })
  }

  const userId = (session.user as any).id as string

  // If circleMemberId provided, update existing member
  if (circleMemberId) {
    const member = await prisma.circleMember.findFirst({
      where: { id: circleMemberId, userId },
    })
    if (!member) {
      return NextResponse.json({ error: 'Circle member not found' }, { status: 404 })
    }

    await prisma.circleMember.update({
      where: { id: circleMemberId },
      data: {
        tasteProfile: JSON.stringify(profile),
        profileUpdatedAt: new Date(),
      },
    })

    return NextResponse.json({ saved: true, circleMemberId })
  }

  // Otherwise, create or find circle member by name/phone
  if (!friendName) {
    return NextResponse.json({ error: 'circleMemberId or friendName required' }, { status: 400 })
  }

  // Try to find existing circle member by phone or create new one
  const memberPhone = phone || `chat-${Date.now()}`
  const existing = phone
    ? await prisma.circleMember.findUnique({ where: { userId_phone: { userId, phone } } })
    : null

  if (existing) {
    await prisma.circleMember.update({
      where: { id: existing.id },
      data: {
        tasteProfile: JSON.stringify(profile),
        profileUpdatedAt: new Date(),
        name: friendName,
      },
    })
    return NextResponse.json({ saved: true, circleMemberId: existing.id })
  }

  const member = await prisma.circleMember.create({
    data: {
      userId,
      phone: memberPhone,
      name: friendName,
      source: 'WHATSAPP',
      tasteProfile: JSON.stringify(profile),
      profileUpdatedAt: new Date(),
    },
  })

  return NextResponse.json({ saved: true, circleMemberId: member.id })
}
