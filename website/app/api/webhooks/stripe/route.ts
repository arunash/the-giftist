import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any

    if (session.metadata?.type === 'wallet_deposit') {
      const { walletId, userId } = session.metadata
      const amountPaid = (session.amount_total || 0) / 100

      try {
        // Credit wallet
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: amountPaid } },
        })

        // Mark transaction as completed
        await prisma.walletTransaction.updateMany({
          where: {
            walletId,
            stripeSessionId: session.id,
            status: 'PENDING',
          },
          data: { status: 'COMPLETED' },
        })

        // Emit activity event
        await createActivity({
          userId,
          type: 'WALLET_DEPOSIT',
          visibility: 'PRIVATE',
          metadata: { amount: amountPaid },
        })
      } catch (error) {
        console.error('Error processing wallet deposit:', error)
        return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
