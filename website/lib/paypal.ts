const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ''
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ''

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // Refresh 60s early
  }
  return cachedToken.token
}

export async function sendPayout(params: {
  recipientType: 'EMAIL' | 'PHONE';
  receiver: string;
  amount: number;
  recipientWallet?: 'VENMO' | 'PAYPAL';
  note?: string;
  senderBatchId: string;
}): Promise<{ payoutBatchId: string; status: string }> {
  const token = await getAccessToken()

  const body = {
    sender_batch_header: {
      sender_batch_id: params.senderBatchId,
      email_subject: 'You received gift funds from Giftist',
      email_message: 'Your gift fund withdrawal has been processed.',
    },
    items: [
      {
        recipient_type: params.recipientType,
        amount: {
          value: params.amount.toFixed(2),
          currency: 'USD',
        },
        receiver: params.receiver,
        note: params.note || 'Giftist gift fund withdrawal',
        ...(params.recipientWallet === 'VENMO' ? { recipient_wallet: 'Venmo' } : {}),
      },
    ],
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`PayPal payout failed: ${res.status} ${errorText}`)
  }

  const data = await res.json()
  return {
    payoutBatchId: data.batch_header.payout_batch_id,
    status: data.batch_header.batch_status,
  }
}
