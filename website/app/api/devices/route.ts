import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pushToken, platform } = await request.json()

  if (!pushToken || typeof pushToken !== 'string') {
    return NextResponse.json({ error: 'pushToken is required' }, { status: 400 })
  }
  if (!platform || !['ios', 'android'].includes(platform)) {
    return NextResponse.json({ error: 'platform must be "ios" or "android"' }, { status: 400 })
  }

  // Upsert: if this token already exists (e.g. reinstall), update the user
  const device = await prisma.device.upsert({
    where: { pushToken },
    update: { userId, platform },
    create: { userId, pushToken, platform },
  })

  return NextResponse.json({ id: device.id })
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pushToken } = await request.json()
  if (!pushToken) {
    return NextResponse.json({ error: 'pushToken is required' }, { status: 400 })
  }

  await prisma.device.deleteMany({
    where: { pushToken, userId },
  })

  return NextResponse.json({ success: true })
}
