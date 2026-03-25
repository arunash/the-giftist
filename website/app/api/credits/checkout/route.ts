import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logApiCall, logError } from '@/lib/api-logger'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userEmail = session.user.email

    // Get or create Stripe customer
    let subscription = await prisma.subscription.findUnique({
      where: { userId },
    })

    let stripeCustomerId: string

    if (subscription?.stripeCustomerId) {
      stripeCustomerId = subscription.stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        email: userEmail || undefined,
        metadata: { userId },
      })
      stripeCustomerId = customer.id

      if (subscription) {
        await prisma.subscription.update({
          where: { userId },
          data: { stripeCustomerId },
        })
      } else {
        await prisma.subscription.create({
          data: {
            userId,
            stripeCustomerId,
            status: 'INACTIVE',
          },
        })
      }
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Giftist Credit Pack',
            description: '50 concierge messages + 5 taste profile analyses',
          },
          unit_amount: 500, // $5.00
        },
        quantity: 1,
      }],
      metadata: {
        type: 'credit_pack',
        userId,
      },
      success_url: `${baseUrl}/settings?credits=success`,
      cancel_url: `${baseUrl}/settings?credits=cancelled`,
    })

    logApiCall({
      provider: 'STRIPE',
      endpoint: '/checkout/sessions',
      userId,
      source: 'WEB',
      metadata: { type: 'credit_pack' },
    }).catch(() => {})

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Error creating credit pack checkout:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
