import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logError } from '@/lib/api-logger'
import { z } from 'zod'

const onboardSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.object({
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1900).max(2010),
  }),
  ssn_last_4: z.string().length(4).regex(/^\d{4}$/),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().length(2),
    postal_code: z.string().min(5),
  }),
  bankAccount: z.object({
    routing_number: z.string().length(9).regex(/^\d{9}$/),
    account_number: z.string().min(4).max(17).regex(/^\d+$/),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, stripeConnectAccountId: true, stripeConnectOnboarded: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = onboardSchema.parse(body)

    let accountId = user.stripeConnectAccountId

    // If there's an existing un-onboarded Express account, delete it first
    if (accountId && !user.stripeConnectOnboarded) {
      try {
        const existing = await stripe.accounts.retrieve(accountId)
        if (existing.type === 'express') {
          await stripe.accounts.del(accountId)
          accountId = null
          await prisma.user.update({
            where: { id: userId },
            data: { stripeConnectAccountId: null, stripeConnectOnboarded: false },
          })
        }
      } catch {
        // Account may already be deleted
        accountId = null
      }
    }

    // If already onboarded with Custom, return success
    if (accountId && user.stripeConnectOnboarded) {
      return NextResponse.json({ success: true, alreadyOnboarded: true })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

    // Create Custom account with full identity + bank info in one call
    const account = await stripe.accounts.create({
      type: 'custom',
      country: 'US',
      email: user.email || undefined,
      business_type: 'individual',
      individual: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: user.email || undefined,
        dob: data.dob,
        ssn_last_4: data.ssn_last_4,
        address: {
          line1: data.address.line1,
          line2: data.address.line2 || undefined,
          city: data.address.city,
          state: data.address.state,
          postal_code: data.address.postal_code,
          country: 'US',
        },
      },
      capabilities: {
        transfers: { requested: true },
      },
      business_profile: {
        mcc: '5947',
        product_description: 'Gift fund contributions',
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip,
      },
      settings: {
        payouts: {
          schedule: { interval: 'manual' as const },
        },
      },
      external_account: {
        object: 'bank_account' as const,
        country: 'US',
        currency: 'usd',
        routing_number: data.bankAccount.routing_number,
        account_number: data.bankAccount.account_number,
      },
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeConnectAccountId: account.id,
        stripeConnectOnboarded: true,
        preferredPayoutMethod: 'STRIPE',
        payoutSetupComplete: true,
      },
    })

    return NextResponse.json({ success: true, accountId: account.id })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message
      }
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 })
    }

    // Map Stripe param errors to field names
    if (error?.type === 'StripeInvalidRequestError' && error?.param) {
      const paramMap: Record<string, string> = {
        'individual[first_name]': 'firstName',
        'individual[last_name]': 'lastName',
        'individual[dob][day]': 'dob.day',
        'individual[dob][month]': 'dob.month',
        'individual[dob][year]': 'dob.year',
        'individual[ssn_last_4]': 'ssn_last_4',
        'individual[address][line1]': 'address.line1',
        'individual[address][city]': 'address.city',
        'individual[address][state]': 'address.state',
        'individual[address][postal_code]': 'address.postal_code',
        'external_account[routing_number]': 'bankAccount.routing_number',
        'external_account[account_number]': 'bankAccount.account_number',
      }
      const field = paramMap[error.param] || error.param
      return NextResponse.json({
        error: error.message,
        fieldErrors: { [field]: error.message },
      }, { status: 400 })
    }

    console.error('Error creating Custom Connect account:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to set up bank account' }, { status: 500 })
  }
}
