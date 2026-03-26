import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.TREMENDOUS_API_KEY || ''
  const sandbox = process.env.TREMENDOUS_SANDBOX
  const fundingSource = process.env.TREMENDOUS_FUNDING_SOURCE_ID

  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey.slice(0, 10) + '...',
    apiKeyLength: apiKey.length,
    sandbox,
    fundingSource,
    baseUrl: sandbox === 'true'
      ? 'https://testflight.tremendous.com/api/v2'
      : 'https://api.tremendous.com/api/v2',
  })
}
