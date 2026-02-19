import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'
import { sendWithdrawalReceipts } from '@/lib/receipts'

const payoutSchema = z.object({
  amount: z.number().positive().min(1),
  method: z.enum(['standard', 'instant']).default('standard'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { amount, method } = payoutSchema.parse(body)

    const isInstant = method === 'instant'
    const fee = isInstant ? Math.max(amount * 0.01, 0.50) : 0
    const netAmount = amount - fee

    if (isInstant && netAmount < 1) {
      return NextResponse.json({ error: 'Amount too small for instant payout after fee' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, phone: true, stripeConnectAccountId: true, stripeConnectOnboarded: true, lifetimeContributionsReceived: true },
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

      // Transfer net amount (after fee) to connected account
      const transferAmount = isInstant ? netAmount : amount
      const transfer = await stripe.transfers.create({
        amount: Math.round(transferAmount * 100),
        currency: 'usd',
        destination: user.stripeConnectAccountId,
      })

      // Custom accounts need explicit payout creation
      // For standard method: create a standard payout on the connected account
      // For instant method: create an instant payout on the connected account
      await stripe.payouts.create(
        {
          amount: Math.round((isInstant ? netAmount : amount) * 100),
          currency: 'usd',
          method: isInstant ? 'instant' : 'standard',
        },
        { stripeAccount: user.stripeConnectAccountId }
      )

      // Decrement contributions received balance (full amount including fee)
      await tx.user.update({
        where: { id: userId },
        data: { lifetimeContributionsReceived: { decrement: amount } },
      })

      // Record transaction in wallet
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
      })

      const description = isInstant
        ? `Instant withdrawal ($${fee.toFixed(2)} fee)`
        : 'Withdrawal to bank'

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYOUT',
          amount: -amount,
          status: 'COMPLETED',
          description,
          stripeSessionId: transfer.id,
        },
      })

      return { balance: availableBalance - amount, transferId: transfer.id, fee: isInstant ? fee : 0, userName: user.name, userEmail: user.email, userPhone: user.phone }
    })

    // Send receipts (email + WhatsApp, non-blocking)
    sendWithdrawalReceipts({
      amount,
      fee: result.fee,
      netAmount,
      method,
      transferId: result.transferId,
      user: {
        name: result.userName,
        email: result.userEmail,
        phone: result.userPhone,
      },
    })

    return NextResponse.json({ balance: result.balance, transferId: result.transferId, fee: result.fee })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (error.message === 'NOT_ONBOARDED') {
      return NextResponse.json({ error: 'Complete bank account setup first' }, { status: 400 })
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
