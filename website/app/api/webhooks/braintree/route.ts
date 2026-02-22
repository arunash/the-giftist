import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { gateway } from '@/lib/braintree'
import { createActivity } from '@/lib/activity'
import { calculateFeeFromContribution } from '@/lib/platform-fee'
import { logError } from '@/lib/api-logger'
import { sendTextMessage } from '@/lib/whatsapp'
import { attemptAutoPayout } from '@/lib/auto-payout'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // Parse Braintree webhook notification
    const btSignature = request.headers.get('bt-signature') || ''
    const notification = await gateway.webhookNotification.parse(btSignature, body)

    if (notification.kind === 'transaction_settled') {
      const txId = notification.transaction?.id
      if (!txId) return NextResponse.json({ received: true })

      // Find the contribution with this Braintree transaction ID
      const contribution = await prisma.contribution.findFirst({
        where: { stripePaymentId: txId, status: 'PENDING' },
        include: {
          item: { include: { user: { select: { id: true, venmoHandle: true, paypalEmail: true, stripeConnectAccountId: true, contributionsReceivedCount: true } } } },
          event: { include: { user: { select: { id: true, phone: true, venmoHandle: true, paypalEmail: true, stripeConnectAccountId: true, contributionsReceivedCount: true } } } },
          contributor: { select: { name: true, phone: true } },
        },
      })

      if (!contribution) return NextResponse.json({ received: true })

      if (contribution.itemId && contribution.item) {
        const item = contribution.item
        const fee = calculateFeeFromContribution(contribution.amount, item.user.contributionsReceivedCount)

        await prisma.contribution.update({
          where: { id: contribution.id },
          data: {
            status: 'COMPLETED',
            platformFeeRate: fee.feeRate,
            platformFeeAmount: fee.feeAmount,
          },
        })

        await prisma.item.update({
          where: { id: item.id },
          data: { fundedAmount: item.fundedAmount + contribution.amount },
        })

        await prisma.user.update({
          where: { id: item.userId },
          data: {
            lifetimeContributionsReceived: { increment: fee.netAmount },
            contributionsReceivedCount: { increment: 1 },
          },
        })

        if (contribution.contributorId) {
          await createActivity({
            userId: contribution.contributorId,
            type: 'ITEM_FUNDED',
            visibility: 'PUBLIC',
            itemId: item.id,
            metadata: { amount: contribution.amount, itemName: item.name },
          })
        }

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

        // WhatsApp notification
        const giftee = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { phone: true },
        })
        if (giftee?.phone) {
          const contributorName = contribution.isAnonymous ? 'Someone' : (contribution.contributor?.name || 'Someone')
          const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
          sendTextMessage(
            giftee.phone,
            `🎁 ${contributorName} contributed $${contribution.amount.toFixed(2)} toward "${item.name}"! View: ${baseUrl}/items/${item.id}`
          ).catch(() => {})
        }

        // Auto-payout if contributor's payment method matches owner's payout method
        attemptAutoPayout(
          { id: contribution.id, amount: contribution.amount, paymentProvider: contribution.paymentProvider, platformFeeAmount: fee.feeAmount },
          item.user,
        ).catch(() => {})
      } else if (contribution.eventId && contribution.event) {
        const evt = contribution.event
        const fee = calculateFeeFromContribution(contribution.amount, evt.user.contributionsReceivedCount)

        await prisma.contribution.update({
          where: { id: contribution.id },
          data: {
            status: 'COMPLETED',
            platformFeeRate: fee.feeRate,
            platformFeeAmount: fee.feeAmount,
          },
        })

        await prisma.event.update({
          where: { id: evt.id },
          data: { fundedAmount: { increment: contribution.amount } },
        })

        await prisma.user.update({
          where: { id: evt.userId },
          data: {
            lifetimeContributionsReceived: { increment: fee.netAmount },
            contributionsReceivedCount: { increment: 1 },
          },
        })

        if (contribution.contributorId) {
          await createActivity({
            userId: contribution.contributorId,
            type: 'EVENT_FUNDED',
            visibility: 'PUBLIC',
            metadata: { amount: contribution.amount, eventName: evt.name },
          })
        }

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

        const giftee = evt.user
        if (giftee?.phone) {
          const contributorName = contribution.isAnonymous ? 'Someone' : (contribution.contributor?.name || 'Someone')
          const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'
          sendTextMessage(
            giftee.phone,
            `🎁 ${contributorName} contributed $${contribution.amount.toFixed(2)} toward "${evt.name}"! View: ${baseUrl}/events/${evt.id}`
          ).catch(() => {})
        }

        // Auto-payout if contributor's payment method matches owner's payout method
        attemptAutoPayout(
          { id: contribution.id, amount: contribution.amount, paymentProvider: contribution.paymentProvider, platformFeeAmount: fee.feeAmount },
          evt.user,
        ).catch(() => {})
      }
    }

    if (notification.kind === 'dispute_opened') {
      const txId = notification.dispute?.transaction?.id
      if (txId) {
        logError({
          source: 'BRAINTREE_WEBHOOK',
          message: `Dispute opened for transaction ${txId}`,
          metadata: { disputeId: notification.dispute?.id },
        }).catch(() => {})
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing Braintree webhook:', error)
    logError({ source: 'BRAINTREE_WEBHOOK', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
