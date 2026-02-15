import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { calculateFeeFromContribution } from '@/lib/platform-fee'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const fundSchema = z.object({
  itemId: z.string(),
  amount: z.number().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { itemId, amount } = fundSchema.parse(body)

    // Use a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } })
      if (!wallet) {
        throw new Error('NO_WALLET')
      }

      if (wallet.balance < amount) {
        throw new Error('INSUFFICIENT_BALANCE')
      }

      const item = await tx.item.findFirst({
        where: { id: itemId, userId },
      })
      if (!item) {
        throw new Error('ITEM_NOT_FOUND')
      }

      // Decrement wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      })

      // Calculate platform fee
      const fee = calculateFeeFromContribution(amount, item.goalAmount, item.priceValue)

      // Increment item funded amount
      const updatedItem = await tx.item.update({
        where: { id: itemId },
        data: { fundedAmount: { increment: amount } },
      })

      // Create contribution record with fee tracking
      await tx.contribution.create({
        data: {
          itemId,
          contributorId: userId,
          amount,
          status: 'COMPLETED',
          platformFeeRate: fee.feeRate,
          platformFeeAmount: fee.feeAmount,
        },
      })

      // Increment item owner's lifetime contributions
      await tx.user.update({
        where: { id: item.userId },
        data: {
          lifetimeContributionsReceived: { increment: fee.netAmount },
        },
      })

      // Create transaction record
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'FUND_ITEM',
          amount: -amount,
          itemId,
          status: 'COMPLETED',
          description: `Funded "${item.name}"`,
        },
      })

      return { balance: wallet.balance - amount, item: updatedItem }
    })

    // Emit activity event
    await createActivity({
      userId,
      type: 'ITEM_FUNDED',
      visibility: 'PUBLIC',
      itemId,
      metadata: { amount, itemName: result.item.name },
    })

    return NextResponse.json({
      balance: result.balance,
      fundedAmount: result.item.fundedAmount,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    if (error.message === 'NO_WALLET') {
      return NextResponse.json({ error: 'Wallet not found. Add money first.' }, { status: 400 })
    }
    if (error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }
    if (error.message === 'ITEM_NOT_FOUND') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    console.error('Error funding item:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to fund item' }, { status: 500 })
  }
}
