import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logError } from '@/lib/api-logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true, stripeConnectOnboarded: true, lifetimeContributionsReceived: true },
    })

    if (!user?.stripeConnectAccountId) {
      return NextResponse.json({ connected: false, onboarded: false })
    }

    // Check current status with Stripe
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId)
    const onboarded = account.details_submitted && (account.payouts_enabled || account.charges_enabled)

    // Update local state if changed
    if (onboarded && !user.stripeConnectOnboarded) {
      await prisma.user.update({
        where: { id: userId },
        data: { stripeConnectOnboarded: true },
      })
    }

    // Request card_payments on existing accounts that don't have it yet
    const hasCardPayments = account.capabilities?.card_payments === 'active' || account.capabilities?.card_payments === 'pending'
    if (onboarded && !hasCardPayments) {
      try {
        await stripe.accounts.update(user.stripeConnectAccountId, {
          capabilities: { card_payments: { requested: true } },
        })
      } catch {
        // Non-critical — don't block the response
      }
    }

    // Per-user available balance: their contributions received, capped by platform's available funds
    let availableBalance = 0
    let pendingBalance = 0
    let instantEligible = false
    if (onboarded) {
      const userBalance = user.lifetimeContributionsReceived || 0
      try {
        const balance = await stripe.balance.retrieve()
        const usdAvailable = balance.available.find((b) => b.currency === 'usd')
        const platformAvailable = (usdAvailable?.amount || 0) / 100
        availableBalance = Math.min(userBalance, platformAvailable)
        pendingBalance = Math.max(0, userBalance - availableBalance)
      } catch {
        availableBalance = 0
        pendingBalance = userBalance
      }

      // Check instant payout eligibility on connected account
      try {
        const connectedBalance = await stripe.balance.retrieve({ stripeAccount: user.stripeConnectAccountId } as any)
        const instantAvailable = connectedBalance.instant_available?.find((b: any) => b.currency === 'usd')
        // Eligible if the connected account has instant payouts enabled (even if current instant balance is 0)
        instantEligible = account.capabilities?.card_payments === 'active' && !!connectedBalance.instant_available
      } catch {
        instantEligible = false
      }
    }

    return NextResponse.json({
      connected: true,
      onboarded: !!onboarded,
      payoutsEnabled: account.payouts_enabled,
      availableBalance,
      pendingBalance,
      instantEligible,
    })
  } catch (error) {
    console.error('Error checking Connect status:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
