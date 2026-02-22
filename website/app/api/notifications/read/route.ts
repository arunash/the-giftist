import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.all === true) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ success: true })
  }

  if (Array.isArray(body.notificationIds) && body.notificationIds.length > 0) {
    await prisma.notification.updateMany({
      where: {
        id: { in: body.notificationIds },
        userId,
      },
      data: { read: true },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Provide notificationIds or all: true' }, { status: 400 })
}
