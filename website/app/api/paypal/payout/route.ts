import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendPayout } from '@/lib/paypal'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const payoutSchema = z.object({
  method: z.enum(['VENMO', 'PAYPAL']),
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
    const { method, amount } = payoutSchema.parse(body)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          lifetimeContributionsReceived: true,
          venmoHandle: true,
          paypalEmail: true,
          preferredPayoutMethod: true,
        },
      })

      if (!user) throw new Error('USER_NOT_FOUND')

      const availableBalance = user.lifetimeContributionsReceived || 0
      if (availableBalance < amount) throw new Error('INSUFFICIENT_BALANCE')

      let receiver: string
      let recipientType: 'EMAIL' | 'PHONE'
      let recipientWallet: 'VENMO' | 'PAYPAL' | undefined

      if (method === 'VENMO') {
        if (!user.venmoHandle) throw new Error('NO_VENMO_HANDLE')
        // Venmo payouts use phone number — but we store the handle
        // PayPal Payouts API with recipient_wallet: Venmo uses the Venmo user ID or phone
        // For handles, we send as PHONE with the handle (PayPal maps @username to Venmo)
        receiver = user.venmoHandle.replace('@', '')
        recipientType = 'PHONE'
        recipientWallet = 'VENMO'
      } else {
        if (!user.paypalEmail) throw new Error('NO_PAYPAL_EMAIL')
        receiver = user.paypalEmail
        recipientType = 'EMAIL'
        recipientWallet = 'PAYPAL'
      }

      const senderBatchId = `giftist_${userId}_${Date.now()}`

      const payoutResult = await sendPayout({
        recipientType,
        receiver,
        amount,
        recipientWallet,
        note: `Giftist gift fund withdrawal - $${amount.toFixed(2)}`,
        senderBatchId,
      })

      // Decrement balance
      await tx.user.update({
        where: { id: userId },
        data: { lifetimeContributionsReceived: { decrement: amount } },
      })

      // Record wallet transaction
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
          description: `Withdrawal to ${method === 'VENMO' ? 'Venmo' : 'PayPal'}`,
          stripeSessionId: payoutResult.payoutBatchId,
        },
      })

      return { balance: availableBalance - amount, payoutBatchId: payoutResult.payoutBatchId }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }
    if (error.message === 'NO_VENMO_HANDLE') {
      return NextResponse.json({ error: 'Please set up your Venmo handle first' }, { status: 400 })
    }
    if (error.message === 'NO_PAYPAL_EMAIL') {
      return NextResponse.json({ error: 'Please set up your PayPal email first' }, { status: 400 })
    }
    console.error('Error processing PayPal payout:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
  }
}
