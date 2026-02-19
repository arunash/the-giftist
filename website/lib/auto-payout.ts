import { prisma } from '@/lib/db'
import { sendPayout } from '@/lib/paypal'
import { stripe } from '@/lib/stripe'
import { logError } from '@/lib/api-logger'

interface AutoPayoutContribution {
  id: string
  amount: number
  paymentProvider: string
  platformFeeAmount: number | null
}

interface AutoPayoutOwner {
  id: string
  venmoHandle: string | null
  paypalEmail: string | null
  stripeConnectAccountId: string | null
}

/**
 * Attempts a direct transfer when the contributor's payment method
 * matches one of the owner's configured payout methods.
 *
 * Returns true if auto-payout succeeded, false otherwise.
 * Never throws — failures are logged and funds stay in lifetimeContributionsReceived.
 */
export async function attemptAutoPayout(
  contribution: AutoPayoutContribution,
  owner: AutoPayoutOwner,
): Promise<boolean> {
  const netAmount = contribution.amount - (contribution.platformFeeAmount || 0)
  if (netAmount <= 0) return false

  try {
    if (contribution.paymentProvider === 'VENMO' && owner.venmoHandle) {
      const receiver = owner.venmoHandle.replace('@', '')
      const senderBatchId = `giftist_auto_${contribution.id}_${Date.now()}`

      await sendPayout({
        recipientType: 'PHONE',
        receiver,
        amount: netAmount,
        recipientWallet: 'VENMO',
        note: `Gift contribution - $${netAmount.toFixed(2)}`,
        senderBatchId,
      })

      await prisma.user.update({
        where: { id: owner.id },
        data: { lifetimeContributionsReceived: { decrement: netAmount } },
      })

      return true
    }

    if (contribution.paymentProvider === 'PAYPAL' && owner.paypalEmail) {
      const senderBatchId = `giftist_auto_${contribution.id}_${Date.now()}`

      await sendPayout({
        recipientType: 'EMAIL',
        receiver: owner.paypalEmail,
        amount: netAmount,
        recipientWallet: 'PAYPAL',
        note: `Gift contribution - $${netAmount.toFixed(2)}`,
        senderBatchId,
      })

      await prisma.user.update({
        where: { id: owner.id },
        data: { lifetimeContributionsReceived: { decrement: netAmount } },
      })

      return true
    }

    if (contribution.paymentProvider === 'STRIPE' && owner.stripeConnectAccountId) {
      await stripe.transfers.create({
        amount: Math.round(netAmount * 100),
        currency: 'usd',
        destination: owner.stripeConnectAccountId,
        metadata: {
          contributionId: contribution.id,
          type: 'auto_payout',
        },
      })

      await prisma.user.update({
        where: { id: owner.id },
        data: { lifetimeContributionsReceived: { decrement: netAmount } },
      })

      return true
    }

    // No matching method — funds stay in lifetimeContributionsReceived
    return false
  } catch (error) {
    console.error('Auto-payout failed for contribution', contribution.id, error)
    logError({
      source: 'AUTO_PAYOUT',
      message: `Auto-payout failed for contribution ${contribution.id}: ${String(error)}`,
      stack: (error as Error)?.stack,
    }).catch(() => {})
    // Leave funds in lifetimeContributionsReceived for manual withdrawal
    return false
  }
}
