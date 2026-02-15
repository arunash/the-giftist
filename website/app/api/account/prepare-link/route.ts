import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  if (!userId) {
    return NextResponse.json({ error: 'No user ID' }, { status: 400 })
  }

  // Store linking intent in the user record (expires in 5 minutes)
  await prisma.user.update({
    where: { id: userId },
    data: {
      linkingToken: `link_${Date.now()}`,
    },
  })

  return NextResponse.json({ ok: true })
}
