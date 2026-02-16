import { prisma } from './db'

// Pricing per million tokens (input / output)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.8, output: 4 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5.2': { input: 2.5, output: 10 },
}

// Fixed costs
const FIXED_COSTS: Record<string, number> = {
  'twilio-verify': 0.05,
  'whatsapp-message': 0.005,
}

function estimateCost(params: {
  provider: string
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  amount?: number | null
}): number {
  const { provider, model, inputTokens, outputTokens, amount } = params

  if (provider === 'STRIPE' && amount) {
    return amount * 0.029 + 0.30
  }

  if (provider === 'WHATSAPP') {
    return FIXED_COSTS['whatsapp-message']
  }

  if (provider === 'TWILIO') {
    return FIXED_COSTS['twilio-verify']
  }

  if (model && PRICING[model]) {
    const p = PRICING[model]
    const inputCost = ((inputTokens || 0) / 1_000_000) * p.input
    const outputCost = ((outputTokens || 0) / 1_000_000) * p.output
    return inputCost + outputCost
  }

  return 0
}

export async function logApiCall(params: {
  provider: string
  endpoint: string
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  userId?: string | null
  source?: string | null
  metadata?: Record<string, any> | null
  amount?: number | null
}) {
  const cost = estimateCost(params)
  try {
    await prisma.apiCallLog.create({
      data: {
        provider: params.provider,
        endpoint: params.endpoint,
        model: params.model || null,
        inputTokens: params.inputTokens || null,
        outputTokens: params.outputTokens || null,
        estimatedCost: cost,
        userId: params.userId || null,
        source: params.source || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    })
  } catch (e) {
    console.error('[api-logger] Failed to log API call:', e)
  }
}

export async function logError(params: {
  source: string
  message: string
  stack?: string | null
  metadata?: Record<string, any> | null
  severity?: string
}) {
  try {
    await prisma.errorLog.create({
      data: {
        source: params.source,
        message: params.message,
        stack: params.stack || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        severity: params.severity || 'ERROR',
      },
    })
  } catch (e) {
    console.error('[api-logger] Failed to log error:', e)
  }
}
