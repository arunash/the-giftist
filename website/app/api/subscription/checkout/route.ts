import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logApiCall, logError } from '@/lib/api-logger'

// POST create Stripe Checkout session for Gold subscription
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userEmail = session.user.email

    const priceId = process.env.STRIPE_GOLD_PRICE_ID
    if (!priceId) {
      return NextResponse.json(
        { error: 'Subscription not configured' },
        { status: 500 }
      )
    }

    // Get or create subscription record
    let subscription = await prisma.subscription.findUnique({
      where: { userId },
    })

    let stripeCustomerId: string

    if (subscription?.stripeCustomerId) {
      stripeCustomerId = subscription.stripeCustomerId
    } else {
      // Create Stripe Customer
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
        subscription = await prisma.subscription.create({
          data: {
            userId,
            stripeCustomerId,
            status: 'INACTIVE',
          },
        })
      }
    }

    // If already active, redirect to portal instead
    if (subscription.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Already subscribed. Use the manage portal instead.' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        type: 'gold_subscription',
        userId,
      },
      success_url: `${baseUrl}/settings?subscription=success`,
      cancel_url: `${baseUrl}/settings?subscription=cancelled`,
    })

    logApiCall({
      provider: 'STRIPE',
      endpoint: '/checkout/sessions',
      userId,
      source: 'WEB',
      metadata: { type: 'subscription' },
    }).catch(() => {})

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Error creating subscription checkout:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
