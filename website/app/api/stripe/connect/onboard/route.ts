import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logError } from '@/lib/api-logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeConnectAccountId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let accountId = user.stripeConnectAccountId

    // Create Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email || undefined,
        capabilities: {
          transfers: { requested: true },
        },
      })
      accountId = account.id

      await prisma.user.update({
        where: { id: userId },
        data: { stripeConnectAccountId: accountId },
      })
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXTAUTH_URL}/wallet?connect=refresh`,
      return_url: `${process.env.NEXTAUTH_URL}/wallet?connect=complete`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error('Error creating Connect onboarding:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to start onboarding' }, { status: 500 })
  }
}
