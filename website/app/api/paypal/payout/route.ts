import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendPayout } from '@/lib/paypal'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'
import { sendEmail } from '@/lib/email'

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
          name: true,
          email: true,
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

      return { balance: availableBalance - amount, payoutBatchId: payoutResult.payoutBatchId, userName: user.name, userEmail: user.email, receiver }
    })

    // Send email receipt (non-blocking)
    if (result.userEmail) {
      const dest = method === 'VENMO' ? `Venmo (${result.receiver})` : `PayPal (${result.receiver})`
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      sendEmail({
        to: result.userEmail,
        subject: `Withdrawal receipt — $${amount.toFixed(2)} to ${method === 'VENMO' ? 'Venmo' : 'PayPal'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin: 0 0 4px; font-size: 20px; color: #111;">Withdrawal Confirmed</h2>
            <p style="margin: 0 0 24px; color: #666; font-size: 14px;">${date}</p>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; font-size: 14px; color: #666;">Amount</p>
              <p style="margin: 0 0 20px; font-size: 28px; font-weight: 700; color: #111;">$${amount.toFixed(2)}</p>
              <p style="margin: 0 0 4px; font-size: 14px; color: #666;">Destination</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111;">${dest}</p>
            </div>
            <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Reference: ${result.payoutBatchId}</p>
            <p style="margin: 0; font-size: 13px; color: #666;">Funds typically arrive within minutes.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="margin: 0; font-size: 12px; color: #999;">Giftist &middot; <a href="https://giftist.ai/wallet" style="color: #999;">View your funds</a></p>
          </div>
        `,
      }).catch((err) => console.error('Failed to send withdrawal receipt:', err))
    }

    return NextResponse.json({ balance: result.balance, payoutBatchId: result.payoutBatchId })
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
