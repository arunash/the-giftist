import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/api-logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            item: { select: { name: true, image: true } },
          },
        },
      },
    })

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              item: { select: { name: true, image: true } },
            },
          },
        },
      })
    }

    return NextResponse.json(wallet)
  } catch (error) {
    console.error('Error fetching wallet:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
  }
}
