import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const payoutSchema = z.object({
  amount: z.number().positive().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { amount } = payoutSchema.parse(body)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { stripeConnectAccountId: true, stripeConnectOnboarded: true, lifetimeContributionsReceived: true },
      })

      if (!user?.stripeConnectAccountId || !user.stripeConnectOnboarded) {
        throw new Error('NOT_ONBOARDED')
      }

      const availableBalance = user.lifetimeContributionsReceived || 0
      if (availableBalance < amount) throw new Error('INSUFFICIENT_BALANCE')

      // Check platform's actual Stripe available balance
      const stripeBalance = await stripe.balance.retrieve()
      const usdAvailable = stripeBalance.available.find((b) => b.currency === 'usd')
      const platformAvailable = (usdAvailable?.amount || 0) / 100
      if (platformAvailable < amount) throw new Error('FUNDS_PENDING')

      // Create Stripe transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // cents
        currency: 'usd',
        destination: user.stripeConnectAccountId,
      })

      // Decrement contributions received balance
      await tx.user.update({
        where: { id: userId },
        data: { lifetimeContributionsReceived: { decrement: amount } },
      })

      // Record transaction in wallet (create wallet if needed)
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
      })

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYOUT',
          amount: -amount,
          status: 'COMPLETED',
          description: `Withdrawal to bank`,
          stripeSessionId: transfer.id,
        },
      })

      return { balance: availableBalance - amount, transferId: transfer.id }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid amount', details: error.errors }, { status: 400 })
    }
    if (error.message === 'NOT_ONBOARDED') {
      return NextResponse.json({ error: 'Complete bank account setup first' }, { status: 400 })
    }
    if (error.message === 'NO_WALLET') {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 400 })
    }
    if (error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }
    if (error.message === 'FUNDS_PENDING') {
      return NextResponse.json({ error: 'Funds are still pending. Please try again in 1-2 business days.' }, { status: 400 })
    }
    console.error('Error processing payout:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
  }
}
