import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPayPalWebhook } from '@/lib/paypal'
import { smartWhatsAppSend } from '@/lib/notifications'

const PAYPAL_WEBHOOK_ID = (process.env.PAYPAL_WEBHOOK_ID || '').trim()

export async function POST(request: NextRequest) {
  const body = await request.text()

  // Verify webhook signature if webhook ID is configured
  if (PAYPAL_WEBHOOK_ID) {
    const verified = await verifyPayPalWebhook({
      webhookId: PAYPAL_WEBHOOK_ID,
      transmissionId: request.headers.get('paypal-transmission-id') || '',
      transmissionTime: request.headers.get('paypal-transmission-time') || '',
      certUrl: request.headers.get('paypal-cert-url') || '',
      authAlgo: request.headers.get('paypal-auth-algo') || '',
      transmissionSig: request.headers.get('paypal-transmission-sig') || '',
      body,
    })

    if (!verified) {
      console.error('[PayPal Webhook] Signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const event = JSON.parse(body)
  const eventType = event.event_type
  const resource = event.resource

  console.log(`[PayPal Webhook] ${eventType}`, JSON.stringify(resource, null, 2))

  // Handle payout item events
  if (eventType === 'PAYMENT.PAYOUTS-ITEM.DENIED' ||
      eventType === 'PAYMENT.PAYOUTS-ITEM.FAILED' ||
      eventType === 'PAYMENT.PAYOUTS-ITEM.BLOCKED' ||
      eventType === 'PAYMENT.PAYOUTS-ITEM.RETURNED') {

    // Extract gift ID from sender_batch_id (format: giftist_gift_{id}_{timestamp})
    const senderBatchId = resource?.payout_item?.sender_item_id || resource?.sender_batch_id || ''
    const payoutBatchId = resource?.payout_batch_id || ''

    // Try to find gift by payout batch ID first, then by sender_batch_id pattern
    let gift = payoutBatchId
      ? await prisma.giftSend.findFirst({ where: { paypalPayoutBatchId: payoutBatchId } })
      : null

    if (!gift && senderBatchId) {
      // Parse gift ID from sender_batch_id: "giftist_gift_{giftId}_{timestamp}"
      const match = senderBatchId.match(/^giftist_gift_([^_]+)_/)
      if (match) {
        gift = await prisma.giftSend.findUnique({ where: { id: match[1] } })
      }
    }

    if (gift && gift.status === 'REDEEMED') {
      await prisma.giftSend.update({
        where: { id: gift.id },
        data: { status: 'REDEEMED_PENDING_REWARD' },
      })

      console.log(`[PayPal Webhook] Gift ${gift.id} payout ${eventType} — marked REDEEMED_PENDING_REWARD`)

      // Notify recipient that payout failed (if they have a phone)
      if (gift.recipientUserId) {
        const recipient = await prisma.user.findUnique({
          where: { id: gift.recipientUserId },
          select: { phone: true },
        })
        if (recipient?.phone) {
          smartWhatsAppSend(
            recipient.phone,
            `Your gift payout of $${gift.amount.toFixed(2)} for "${gift.itemName}" couldn't be completed. Please visit https://giftist.ai/gift/${gift.redeemCode} to try again with a different payment method.`,
            'payout_failed_recipient',
            [gift.amount.toFixed(2), gift.itemName, gift.redeemCode]
          ).catch(() => {})
        }
      }
    }
  }

  if (eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') {
    const payoutBatchId = resource?.payout_batch_id || ''
    const senderBatchId = resource?.payout_item?.sender_item_id || resource?.sender_batch_id || ''

    let gift = payoutBatchId
      ? await prisma.giftSend.findFirst({ where: { paypalPayoutBatchId: payoutBatchId } })
      : null

    if (!gift && senderBatchId) {
      const match = senderBatchId.match(/^giftist_gift_([^_]+)_/)
      if (match) {
        gift = await prisma.giftSend.findUnique({ where: { id: match[1] } })
      }
    }

    // If gift was stuck in REDEEMED_PENDING_REWARD (retry succeeded), mark as REDEEMED
    if (gift && gift.status === 'REDEEMED_PENDING_REWARD') {
      await prisma.giftSend.update({
        where: { id: gift.id },
        data: { status: 'REDEEMED' },
      })
      console.log(`[PayPal Webhook] Gift ${gift.id} payout succeeded — marked REDEEMED`)
    }
  }

  return NextResponse.json({ received: true })
}
