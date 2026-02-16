import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'No user ID' }, { status: 400 })
  }

  // Store linking intent with HMAC-signed token bound to this user (expires in 5 minutes)
  const timestamp = Date.now().toString()
  const secret = process.env.NEXTAUTH_SECRET || ''
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(`link_${userId}_${timestamp}`)
    .digest('hex')
    .slice(0, 16)

  await prisma.user.update({
    where: { id: userId },
    data: {
      linkingToken: `link_${userId}_${timestamp}_${hmac}`,
    },
  })

  return NextResponse.json({ ok: true })
}
