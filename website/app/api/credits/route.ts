import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { messageCredits: true, profileCredits: true },
  })

  return NextResponse.json({
    messageCredits: user?.messageCredits ?? 0,
    profileCredits: user?.profileCredits ?? 0,
  })
}
