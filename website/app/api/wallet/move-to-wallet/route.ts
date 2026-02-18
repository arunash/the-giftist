import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const moveSchema = z.object({
  amount: z.number().positive().min(0.01),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { amount } = moveSchema.parse(body)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { lifetimeContributionsReceived: true },
      })

      const available = user?.lifetimeContributionsReceived || 0
      if (available < amount) throw new Error('INSUFFICIENT_BALANCE')

      // Decrement received balance
      await tx.user.update({
        where: { id: userId },
        data: { lifetimeContributionsReceived: { decrement: amount } },
      })

      // Increment wallet balance (upsert wallet if needed)
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
      })

      // Record transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'RECEIVED_TO_WALLET',
          amount,
          status: 'COMPLETED',
          description: 'Moved received funds to wallet',
        },
      })

      return { walletBalance: wallet.balance, remainingReceived: available - amount }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ error: 'Insufficient received funds' }, { status: 400 })
    }
    console.error('Error moving funds to wallet:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to move funds' }, { status: 500 })
  }
}
