import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logApiCall, logError } from '@/lib/api-logger'
import { z } from 'zod'

const depositSchema = z.object({
  amount: z.number().min(1).max(10000),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { amount } = depositSchema.parse(body)

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId } })
    }

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Giftist Wallet Deposit',
              description: `Add $${amount.toFixed(2)} to your Giftist wallet`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        walletId: wallet.id,
        userId,
        type: 'wallet_deposit',
      },
      success_url: `${process.env.NEXTAUTH_URL}/wallet?deposit=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/wallet?deposit=cancelled`,
    })

    // Create pending transaction
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount,
        stripeSessionId: checkoutSession.id,
        status: 'PENDING',
        description: `Deposit $${amount.toFixed(2)}`,
      },
    })

    logApiCall({
      provider: 'STRIPE',
      endpoint: '/checkout/sessions',
      userId,
      source: 'WEB',
      amount,
    }).catch(() => {})

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    console.error('Error creating deposit:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to create deposit' }, { status: 500 })
  }
}
