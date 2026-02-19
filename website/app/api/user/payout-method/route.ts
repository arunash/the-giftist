import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const payoutMethodSchema = z.object({
  method: z.enum(['STRIPE', 'VENMO', 'PAYPAL']),
  venmoHandle: z.string().optional(),
  paypalEmail: z.string().email().optional(),
}).refine(data => {
  if (data.method === 'VENMO' && !data.venmoHandle) return false
  if (data.method === 'PAYPAL' && !data.paypalEmail) return false
  return true
}, { message: 'Missing account details for selected method' })

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const data = payoutMethodSchema.parse(body)

    const updateData: any = {
      preferredPayoutMethod: data.method,
    }

    if (data.method === 'VENMO') {
      // Normalize handle: ensure it starts with @
      let handle = data.venmoHandle!.trim()
      if (!handle.startsWith('@')) handle = '@' + handle
      updateData.venmoHandle = handle
      updateData.payoutSetupComplete = true
    } else if (data.method === 'PAYPAL') {
      updateData.paypalEmail = data.paypalEmail!.trim()
      updateData.payoutSetupComplete = true
    }
    // STRIPE method: payoutSetupComplete is set during bank onboarding, not here

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payout method data' }, { status: 400 })
    }
    console.error('Error saving payout method:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to save payout method' }, { status: 500 })
  }
}

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
        preferredPayoutMethod: true,
        venmoHandle: true,
        paypalEmail: true,
        payoutSetupComplete: true,
      },
    })

    return NextResponse.json(user || {})
  } catch (error) {
    console.error('Error fetching payout method:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to fetch payout method' }, { status: 500 })
  }
}
