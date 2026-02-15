import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { calculateFeeFromContribution } from '@/lib/platform-fee'
import { logError } from '@/lib/api-logger'
import { sendTextMessage } from '@/lib/whatsapp'

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
            include: {
              item: true,
              event: { include: { user: true } },
              contributor: { select: { name: true, phone: true } },
            },
          })

          if (contribution && contribution.status === 'PENDING') {
            if (contribution.itemId && contribution.item) {
              // Item-level contribution
              const item = contribution.item

              const fee = calculateFeeFromContribution(
                contribution.amount,
                item.goalAmount,
                item.priceValue
              )

              await prisma.contribution.update({
                where: { id: contributionId },
                data: {
                  status: 'COMPLETED',
                  stripePaymentId: session.payment_intent as string,
                  platformFeeRate: fee.feeRate,
                  platformFeeAmount: fee.feeAmount,
                },
              })

              const newFundedAmount = item.fundedAmount + contribution.amount
              await prisma.item.update({
                where: { id: item.id },
                data: { fundedAmount: newFundedAmount },
              })

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
                  contributorName: contribution.isAnonymous ? 'Anonymous' : (contribution.contributor?.name || 'Someone'),
                },
              })

              // WhatsApp notification to giftee
              const giftee = await prisma.user.findUnique({
                where: { id: item.userId },
                select: { phone: true, name: true },
              })
              if (giftee?.phone) {
                const contributorName = contribution.isAnonymous ? 'Someone' : (contribution.contributor?.name || 'Someone')
                const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
                sendTextMessage(
                  giftee.phone,
                  `🎁 ${contributorName} contributed $${contribution.amount.toFixed(2)} toward "${item.name}"! Purchase it yourself and withdraw the funds: ${baseUrl}/items/${item.id}`
                ).catch((err) => console.error('WhatsApp notification failed:', err))
              }
            } else if (contribution.eventId && contribution.event) {
              // Event-level contribution
              const evt = contribution.event

              const fee = calculateFeeFromContribution(
                contribution.amount,
                null,
                null
              )

              await prisma.contribution.update({
                where: { id: contributionId },
                data: {
                  status: 'COMPLETED',
                  stripePaymentId: session.payment_intent as string,
                  platformFeeRate: fee.feeRate,
                  platformFeeAmount: fee.feeAmount,
                },
              })

              // Increment event fundedAmount
              await prisma.event.update({
                where: { id: evt.id },
                data: { fundedAmount: { increment: contribution.amount } },
              })

              // Increment event owner's lifetime contributions received
              await prisma.user.update({
                where: { id: evt.userId },
                data: {
                  lifetimeContributionsReceived: { increment: fee.netAmount },
                },
              })

              // Activity: contributor funded event
              if (contribution.contributorId) {
                await createActivity({
                  userId: contribution.contributorId,
                  type: 'EVENT_FUNDED',
                  visibility: 'PUBLIC',
                  metadata: { amount: contribution.amount, eventName: evt.name },
                })
              }

              // Activity: event owner received contribution
              await createActivity({
                userId: evt.userId,
                type: 'EVENT_CONTRIBUTION_RECEIVED',
                visibility: 'PRIVATE',
                metadata: {
                  amount: contribution.amount,
                  eventName: evt.name,
                  contributorName: contribution.isAnonymous ? 'Anonymous' : (contribution.contributor?.name || 'Someone'),
                },
              })

              // WhatsApp notification to giftee
              const giftee = evt.user
              if (giftee?.phone) {
                const contributorName = contribution.isAnonymous ? 'Someone' : (contribution.contributor?.name || 'Someone')
                const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
                sendTextMessage(
                  giftee.phone,
                  `🎁 ${contributorName} contributed $${contribution.amount.toFixed(2)} toward your "${evt.name}" gift fund! Allocate the funds to specific items: ${baseUrl}/events/${evt.id}`
                ).catch((err) => console.error('WhatsApp notification failed:', err))
              }
            }
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
