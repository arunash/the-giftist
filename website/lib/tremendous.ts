const API_KEY = process.env.TREMENDOUS_API_KEY || ''
const BASE_URL = process.env.TREMENDOUS_SANDBOX === 'true'
  ? 'https://testflight.tremendous.com/api/v2'
  : 'https://api.tremendous.com/api/v2'

interface TremendousReward {
  orderId: string
  rewardId: string
  claimLink: string
}

/**
 * Create a Tremendous reward with a claim link.
 * Recipient chooses how to receive: Amazon gift card, Visa, Venmo, PayPal, etc.
 */
export async function createTremendousReward(opts: {
  amount: number           // USD
  recipientName?: string
  externalId: string       // for idempotency (e.g. giftSendId)
}): Promise<TremendousReward> {
  const res = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_id: opts.externalId,
      payment: {
        funding_source_id: 'balance',
      },
      reward: {
        recipient: {
          name: opts.recipientName || 'Gift Recipient',
        },
        value: {
          denomination: opts.amount,
          currency_code: 'USD',
        },
        delivery: {
          method: 'LINK',
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[Tremendous] Create reward failed:', res.status, err)
    throw new Error(`Tremendous API error: ${res.status}`)
  }

  const data = await res.json()
  const order = data.order
  const reward = order.rewards[0]

  return {
    orderId: order.id,
    rewardId: reward.id,
    claimLink: reward.delivery.link,
  }
}

/**
 * Regenerate a claim link for an existing reward.
 */
export async function regenerateTremendousLink(rewardId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/rewards/${rewardId}/generate_link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[Tremendous] Regenerate link failed:', res.status, err)
    throw new Error(`Tremendous API error: ${res.status}`)
  }

  const data = await res.json()
  return data.reward.link
}
