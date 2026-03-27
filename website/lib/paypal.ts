import { logApiCall } from './api-logger'

const PAYPAL_API_BASE = (process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').trim()
const PAYPAL_CLIENT_ID = (process.env.PAYPAL_CLIENT_ID || '').trim()
const PAYPAL_CLIENT_SECRET = (process.env.PAYPAL_CLIENT_SECRET || '').trim()

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

// --- PayPal Orders API (sender payment collection) ---

export async function createPayPalOrder(params: {
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  customId?: string;
}): Promise<{ orderId: string; approvalUrl: string }> {
  const token = await getAccessToken()

  const body = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: params.amount.toFixed(2),
      },
      description: params.description,
      custom_id: params.customId,
    }],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: 'The Giftist',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      },
    },
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`PayPal create order failed: ${res.status} ${errorText}`)
  }

  const data = await res.json()
  const approvalLink = data.links?.find((l: any) => l.rel === 'payer-action')?.href
    || data.links?.find((l: any) => l.rel === 'approve')?.href

  if (!approvalLink) {
    throw new Error('PayPal order created but no approval URL returned')
  }

  logApiCall({
    provider: 'PAYPAL',
    endpoint: '/v2/checkout/orders',
    amount: params.amount,
    source: 'ORDER_CREATE',
    metadata: { orderId: data.id },
  }).catch(() => {})

  return { orderId: data.id, approvalUrl: approvalLink }
}

export async function capturePayPalOrder(orderId: string): Promise<{
  captureId: string;
  status: string;
  amount: string;
}> {
  const token = await getAccessToken()

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`PayPal capture failed: ${res.status} ${errorText}`)
  }

  const data = await res.json()
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]

  logApiCall({
    provider: 'PAYPAL',
    endpoint: `/v2/checkout/orders/${orderId}/capture`,
    amount: parseFloat(capture?.amount?.value || '0'),
    source: 'ORDER_CAPTURE',
    metadata: { orderId, captureId: capture?.id, status: data.status },
  }).catch(() => {})

  return {
    captureId: capture?.id || orderId,
    status: data.status,
    amount: capture?.amount?.value || '0',
  }
}

// --- PayPal Payouts API (recipient disbursement) ---

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

  logApiCall({
    provider: 'PAYPAL',
    endpoint: '/v1/payments/payouts',
    amount: params.amount,
    source: 'PAYOUT',
    metadata: {
      recipientType: params.recipientType,
      recipientWallet: params.recipientWallet || 'PAYPAL',
      batchId: data.batch_header.payout_batch_id,
    },
  }).catch(() => {})

  return {
    payoutBatchId: data.batch_header.payout_batch_id,
    status: data.batch_header.batch_status,
  }
}
