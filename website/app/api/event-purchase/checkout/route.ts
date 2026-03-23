import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logApiCall, logError } from '@/lib/api-logger'

const EVENT_PASS_PRICE_CENTS = 299 // $2.99

// POST create Stripe Checkout session for Event Pass (one-time payment)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userEmail = session.user.email

    // Check if user is Gold (Gold gets unlimited events)
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true, stripeCustomerId: true },
    })

    const isGold = subscription?.status === 'ACTIVE' &&
      (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date())

    if (isGold) {
      return NextResponse.json(
        { error: 'Gold members have unlimited events.' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let stripeCustomerId: string

    if (subscription?.stripeCustomerId) {
      stripeCustomerId = subscription.stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        email: userEmail || undefined,
        metadata: { userId },
      })
      stripeCustomerId = customer.id

      // Store customer ID in subscription record (create if needed)
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

    // Create EventPurchase record
    const eventPurchase = await prisma.eventPurchase.create({
      data: {
        userId,
        amount: EVENT_PASS_PRICE_CENTS / 100,
        status: 'PENDING',
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Giftist Event Pass',
            description: 'Create and manage one event with full concierge support',
          },
          unit_amount: EVENT_PASS_PRICE_CENTS,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'event_purchase',
        userId,
        eventPurchaseId: eventPurchase.id,
      },
      success_url: `${baseUrl}/events?purchase=success`,
      cancel_url: `${baseUrl}/events?purchase=cancelled`,
    })

    // Store Stripe session ID
    await prisma.eventPurchase.update({
      where: { id: eventPurchase.id },
      data: { stripeSessionId: checkoutSession.id },
    })

    logApiCall({
      provider: 'STRIPE',
      endpoint: '/checkout/sessions',
      userId,
      source: 'WEB',
      metadata: { type: 'event_purchase' },
    }).catch(() => {})

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Error creating event purchase checkout:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
