import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { calculateFeeFromContribution } from '@/lib/platform-fee'
import { logError } from '@/lib/api-logger'

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
    logError({ source: 'STRIPE_WEBHOOK', message: err.message, stack: err.stack }).catch(() => {})
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const type = session.metadata?.type

        if (type === 'wallet_deposit') {
          const { walletId, userId } = session.metadata
          const amountPaid = (session.amount_total || 0) / 100

          await prisma.wallet.update({
            where: { id: walletId },
            data: { balance: { increment: amountPaid } },
          })

          await prisma.walletTransaction.updateMany({
            where: {
              walletId,
              stripeSessionId: session.id,
              status: 'PENDING',
            },
            data: { status: 'COMPLETED' },
          })

          await createActivity({
            userId,
            type: 'WALLET_DEPOSIT',
            visibility: 'PRIVATE',
            metadata: { amount: amountPaid },
          })
        }

        if (type === 'contribution') {
          const { contributionId } = session.metadata

          const contribution = await prisma.contribution.findUnique({
            where: { id: contributionId },
            include: { item: true },
          })

          if (contribution && contribution.status === 'PENDING') {
            const item = contribution.item

            // Calculate platform fee from the goal/price ratio
            const fee = calculateFeeFromContribution(
              contribution.amount,
              item.goalAmount,
              item.priceValue
            )

            // Mark contribution completed with fee info
            await prisma.contribution.update({
              where: { id: contributionId },
              data: {
                status: 'COMPLETED',
                stripePaymentId: session.payment_intent as string,
                platformFeeRate: fee.feeRate,
                platformFeeAmount: fee.feeAmount,
              },
            })

            // Update item funded amount
            const newFundedAmount = item.fundedAmount + contribution.amount

            await prisma.item.update({
              where: { id: item.id },
              data: { fundedAmount: newFundedAmount },
            })

            // Increment item owner's lifetime contributions received (net of fees)
            await prisma.user.update({
              where: { id: item.userId },
              data: {
                lifetimeContributionsReceived: { increment: fee.netAmount },
              },
            })

            // Activity: contributor funded item
            if (contribution.contributorId) {
              await createActivity({
                userId: contribution.contributorId,
                type: 'ITEM_FUNDED',
                visibility: 'PUBLIC',
                itemId: item.id,
                metadata: { amount: contribution.amount, itemName: item.name },
              })
            }

            // Activity: item owner received contribution
            await createActivity({
              userId: item.userId,
              type: 'CONTRIBUTION_RECEIVED',
              visibility: 'PRIVATE',
              itemId: item.id,
              metadata: {
                amount: contribution.amount,
                contributorName: contribution.isAnonymous ? 'Anonymous' : 'Someone',
              },
            })
          }
        }

        if (type === 'gold_subscription') {
          const { userId } = session.metadata
          const subscriptionId = session.subscription as string

          await prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: subscriptionId,
              status: 'ACTIVE',
            },
          })
        }

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const stripeSubId = subscription.id

        const statusMap: Record<string, string> = {
          active: 'ACTIVE',
          past_due: 'PAST_DUE',
          canceled: 'CANCELED',
          unpaid: 'PAST_DUE',
          incomplete: 'INACTIVE',
          incomplete_expired: 'CANCELED',
          trialing: 'ACTIVE',
          paused: 'INACTIVE',
        }

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: stripeSubId },
          data: {
            status: statusMap[subscription.status] || 'INACTIVE',
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            stripePriceId: subscription.items?.data?.[0]?.price?.id || undefined,
          },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: 'CANCELED' },
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription as string },
            data: { status: 'PAST_DUE' },
          })
        }
        break
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error)
    logError({ source: 'STRIPE_WEBHOOK', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
