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
      select: {
        stripeConnectAccountId: true,
        stripeConnectOnboarded: true,
        lifetimeContributionsReceived: true,
        preferredPayoutMethod: true,
        venmoHandle: true,
        paypalEmail: true,
        payoutSetupComplete: true,
      },
    })

    if (!user?.stripeConnectAccountId) {
      return NextResponse.json({
        connected: false,
        onboarded: false,
        preferredPayoutMethod: user?.preferredPayoutMethod || null,
        venmoHandle: user?.venmoHandle || null,
        paypalEmail: user?.paypalEmail || null,
        payoutSetupComplete: user?.payoutSetupComplete || false,
      })
    }

    // Check current status with Stripe
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId)

    // Custom accounts: check transfers capability + requirements
    const isCustom = account.type === 'custom'
    const transfersCapability = (account.capabilities as any)?.transfers
    const onboarded = isCustom
      ? transfersCapability === 'active' || (account.details_submitted && !account.requirements?.currently_due?.length)
      : account.details_submitted && (account.payouts_enabled || account.charges_enabled)

    // Update local state if changed
    if (onboarded && !user.stripeConnectOnboarded) {
      await prisma.user.update({
        where: { id: userId },
        data: { stripeConnectOnboarded: true },
      })
    }

    // Per-user available balance
    let availableBalance = 0
    let pendingBalance = 0
    let instantEligible = false
    const currentlyDue = account.requirements?.currently_due || []

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
        pendingBalance = user.lifetimeContributionsReceived || 0
      }

      // Check instant payout eligibility
      try {
        const connectedBalance = await stripe.balance.retrieve({ stripeAccount: user.stripeConnectAccountId } as any)
        instantEligible = Array.isArray(connectedBalance.instant_available) && connectedBalance.instant_available.length > 0
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
      currentlyDue,
      accountType: account.type,
      preferredPayoutMethod: user.preferredPayoutMethod,
      venmoHandle: user.venmoHandle,
      paypalEmail: user.paypalEmail,
      payoutSetupComplete: user.payoutSetupComplete,
    })
  } catch (error) {
    console.error('Error checking Connect status:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
