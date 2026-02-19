import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { gateway } from '@/lib/braintree'
import { logApiCall, logError } from '@/lib/api-logger'
import { z } from 'zod'

const checkoutSchema = z.object({
  nonce: z.string().min(1),
  contributionId: z.string().min(1),
  amount: z.number().positive(),
  provider: z.enum(['VENMO', 'PAYPAL']),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const contributorId = (session?.user as any)?.id || null

    const body = await request.json()
    const data = checkoutSchema.parse(body)

    // Verify the contribution exists and is pending
    const contribution = await prisma.contribution.findUnique({
      where: { id: data.contributionId },
    })

    if (!contribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
    }

    if (contribution.status !== 'PENDING') {
      return NextResponse.json({ error: 'Contribution already processed' }, { status: 400 })
    }

    // Process Braintree transaction
    const result = await gateway.transaction.sale({
      amount: data.amount.toFixed(2),
      paymentMethodNonce: data.nonce,
      options: {
        submitForSettlement: true,
      },
    })

    if (!result.success) {
      console.error('Braintree transaction failed:', result.message)
      await prisma.contribution.update({
        where: { id: data.contributionId },
        data: { status: 'FAILED' },
      })
      return NextResponse.json({ error: result.message || 'Payment failed' }, { status: 400 })
    }

    // Update contribution with Braintree transaction ID (status stays PENDING until webhook confirms settlement)
    await prisma.contribution.update({
      where: { id: data.contributionId },
      data: {
        stripePaymentId: result.transaction.id, // Reuse field for Braintree tx ID
        paymentProvider: data.provider,
        status: 'PENDING', // Will be marked COMPLETED by webhook on settlement
      },
    })

    logApiCall({
      provider: 'BRAINTREE',
      endpoint: '/transaction/sale',
      userId: contributorId,
      source: 'WEB',
      amount: data.amount,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      transactionId: result.transaction.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 })
    }
    console.error('Error processing Braintree checkout:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 })
  }
}
