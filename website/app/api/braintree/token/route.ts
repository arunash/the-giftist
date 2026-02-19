import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/api-logger'

export async function POST(request: NextRequest) {
  try {
    // Debug: check env vars are present
    const hasEnv = {
      merchantId: !!process.env.BRAINTREE_MERCHANT_ID,
      publicKey: !!process.env.BRAINTREE_PUBLIC_KEY,
      privateKey: !!process.env.BRAINTREE_PRIVATE_KEY,
      environment: process.env.BRAINTREE_ENVIRONMENT || 'not set',
    }
    console.log('Braintree env check:', JSON.stringify(hasEnv))

    const { gateway } = await import('@/lib/braintree')
    const response = await gateway.clientToken.generate({})
    return NextResponse.json({ clientToken: response.clientToken })
  } catch (error: any) {
    console.error('Error generating Braintree client token:', error?.message || error, error?.stack)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to generate payment token', details: error?.message || String(error) }, { status: 500 })
  }
}
