import { sendEmail } from '@/lib/email'
import { sendTextMessage } from '@/lib/whatsapp'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://giftist.ai'

// ── Contribution receipts (to both contributor and gift owner) ──

interface ContributionReceiptData {
  amount: number
  itemName?: string
  eventName?: string
  itemId?: string | null
  eventId?: string | null
  contributorName: string
  isAnonymous: boolean
  contributor: {
    email?: string | null
    phone?: string | null
  }
  owner: {
    name?: string | null
    email?: string | null
    phone?: string | null
  }
}

export function sendContributionReceipts(data: ContributionReceiptData) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const giftLabel = data.itemName || data.eventName || 'a gift'
  const viewUrl = data.itemId
    ? `${BASE_URL}/items/${data.itemId}`
    : data.eventId
      ? `${BASE_URL}/events/${data.eventId}`
      : `${BASE_URL}/wallet`

  // ── Receipt to contributor ──

  // Email to contributor
  if (data.contributor.email) {
    sendEmail({
      to: data.contributor.email,
      subject: `Contribution receipt — $${data.amount.toFixed(2)} toward ${giftLabel}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 4px; font-size: 20px; color: #111;">Thank you for your contribution!</h2>
          <p style="margin: 0 0 24px; color: #666; font-size: 14px;">${date}</p>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #666;">Amount</p>
            <p style="margin: 0 0 20px; font-size: 28px; font-weight: 700; color: #111;">$${data.amount.toFixed(2)}</p>
            <p style="margin: 0 0 4px; font-size: 14px; color: #666;">Gift</p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111;">${giftLabel}</p>
          </div>
          <p style="margin: 0; font-size: 13px; color: #666;">${data.owner.name || 'The recipient'} will be notified and can use these funds to purchase the gift.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="margin: 0; font-size: 12px; color: #999;">Giftist &middot; <a href="${BASE_URL}" style="color: #999;">giftist.ai</a></p>
        </div>
      `,
    }).catch((err) => console.error('Failed to send contributor email receipt:', err))
  }

  // WhatsApp to contributor
  if (data.contributor.phone) {
    sendTextMessage(
      data.contributor.phone,
      `✅ Receipt: You contributed $${data.amount.toFixed(2)} toward "${giftLabel}". ${data.owner.name || 'The recipient'} will be notified. Thank you!`
    ).catch((err) => console.error('Failed to send contributor WhatsApp receipt:', err))
  }

  // ── Receipt to gift owner ──

  const displayName = data.isAnonymous ? 'Someone' : data.contributorName

  // Email to owner
  if (data.owner.email) {
    sendEmail({
      to: data.owner.email,
      subject: `${displayName} contributed $${data.amount.toFixed(2)} toward ${giftLabel}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 4px; font-size: 20px; color: #111;">You received a contribution!</h2>
          <p style="margin: 0 0 24px; color: #666; font-size: 14px;">${date}</p>
          <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #166534;">Amount</p>
            <p style="margin: 0 0 20px; font-size: 28px; font-weight: 700; color: #166534;">+$${data.amount.toFixed(2)}</p>
            <p style="margin: 0 0 4px; font-size: 14px; color: #166534;">From</p>
            <p style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #111;">${displayName}</p>
            <p style="margin: 0 0 4px; font-size: 14px; color: #166534;">Gift</p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111;">${giftLabel}</p>
          </div>
          <a href="${viewUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px;">View &amp; Withdraw Funds</a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="margin: 0; font-size: 12px; color: #999;">Giftist &middot; <a href="${BASE_URL}/wallet" style="color: #999;">View your funds</a></p>
        </div>
      `,
    }).catch((err) => console.error('Failed to send owner email receipt:', err))
  }

  // WhatsApp to owner
  if (data.owner.phone) {
    sendTextMessage(
      data.owner.phone,
      `🎁 ${displayName} contributed $${data.amount.toFixed(2)} toward "${giftLabel}"! View and withdraw your funds: ${viewUrl}`
    ).catch((err) => console.error('Failed to send owner WhatsApp receipt:', err))
  }
}

// ── Withdrawal receipts (to the withdrawer) ──

interface WithdrawalReceiptData {
  amount: number
  fee: number
  netAmount: number
  method: 'standard' | 'instant'
  transferId: string
  user: {
    name?: string | null
    email?: string | null
    phone?: string | null
  }
}

export function sendWithdrawalReceipts(data: WithdrawalReceiptData) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const isInstant = data.method === 'instant'
  const methodDesc = isInstant ? 'Bank (instant)' : 'Bank (standard)'
  const arrivalNote = isInstant ? 'Funds typically arrive within minutes.' : 'Standard payouts arrive in 1-2 business days.'

  const feeLine = data.fee > 0
    ? `<p style="margin: 0 0 4px; font-size: 14px; color: #666;">Fee</p><p style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #111;">$${data.fee.toFixed(2)}</p><p style="margin: 0 0 4px; font-size: 14px; color: #666;">You receive</p><p style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #111;">$${data.netAmount.toFixed(2)}</p>`
    : ''

  // Email receipt
  if (data.user.email) {
    sendEmail({
      to: data.user.email,
      subject: `Withdrawal receipt — $${data.amount.toFixed(2)} to bank`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 4px; font-size: 20px; color: #111;">Withdrawal Confirmed</h2>
          <p style="margin: 0 0 24px; color: #666; font-size: 14px;">${date}</p>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #666;">Amount</p>
            <p style="margin: 0 0 20px; font-size: 28px; font-weight: 700; color: #111;">$${data.amount.toFixed(2)}</p>
            ${feeLine}
            <p style="margin: 0 0 4px; font-size: 14px; color: #666;">Destination</p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111;">${methodDesc}</p>
          </div>
          <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Reference: ${data.transferId}</p>
          <p style="margin: 0; font-size: 13px; color: #666;">${arrivalNote}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="margin: 0; font-size: 12px; color: #999;">Giftist &middot; <a href="${BASE_URL}/wallet" style="color: #999;">View your funds</a></p>
        </div>
      `,
    }).catch((err) => console.error('Failed to send withdrawal email receipt:', err))
  }

  // WhatsApp receipt
  if (data.user.phone) {
    const feeNote = data.fee > 0 ? ` ($${data.fee.toFixed(2)} fee, you receive $${data.netAmount.toFixed(2)})` : ''
    sendTextMessage(
      data.user.phone,
      `💰 Withdrawal confirmed: $${data.amount.toFixed(2)} to your bank account${feeNote}. ${arrivalNote} Ref: ${data.transferId}`
    ).catch((err) => console.error('Failed to send withdrawal WhatsApp receipt:', err))
  }
}
