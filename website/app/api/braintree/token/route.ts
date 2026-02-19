import { NextRequest, NextResponse } from 'next/server'
import { gateway } from '@/lib/braintree'
import { logError } from '@/lib/api-logger'

export async function POST(request: NextRequest) {
  try {
    const response = await gateway.clientToken.generate({})
    return NextResponse.json({ clientToken: response.clientToken })
  } catch (error) {
    console.error('Error generating Braintree client token:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to generate payment token' }, { status: 500 })
  }
}
