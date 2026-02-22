import { sendEmail } from '@/lib/email'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://giftist.ai'
const LOGO_URL = `${BASE_URL}/logo-light.png`

function emailWrapper(body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 0;">
      <div style="padding: 24px 24px 16px; display: flex; align-items: center;">
        <a href="${BASE_URL}" style="text-decoration: none; display: flex; align-items: center; gap: 10px;">
          <img src="${LOGO_URL}" alt="The Giftist" width="36" height="36" style="border-radius: 8px;" />
          <span style="font-size: 16px; font-weight: 700; color: #111; letter-spacing: -0.3px;">The Giftist</span>
        </a>
      </div>
      <div style="padding: 0 24px 24px;">
        ${body}
      </div>
      <div style="border-top: 1px solid #eee; padding: 16px 24px; text-align: center;">
        <p style="margin: 0; font-size: 11px; color: #999;">
          <a href="${BASE_URL}" style="color: #999; text-decoration: none;">The Giftist</a> &middot; Your personal gift concierge
        </p>
      </div>
    </div>
  `
}

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
  feeAmount: number
  netAmount: number
  isFreeContribution: boolean
  freeRemaining: number
}

function feeLabel(data: ContributionReceiptData): string {
  if (data.isFreeContribution) {
    return `$0.00 (free \u2014 ${data.freeRemaining} of 10 remaining)`
  }
  return `$${data.feeAmount.toFixed(2)} (2%)`
}

function ownerFeeLabel(data: ContributionReceiptData): string {
  if (data.isFreeContribution) {
    const used = 10 - data.freeRemaining
    return `$0.00 (free contribution ${used} of 10)`
  }
  return `-$${data.feeAmount.toFixed(2)} (2%)`
}

export async function sendContributionReceipts(data: ContributionReceiptData) {
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
    const feeRow = `<tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Platform fee</td><td style="padding: 4px 0; font-size: 13px; color: #666;">${feeLabel(data)}</td></tr>`
    const ownerReceivesRow = `<tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Owner receives</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">$${data.netAmount.toFixed(2)}</td></tr>`

    await sendEmail({
      to: data.contributor.email,
      subject: `Contribution receipt — $${data.amount.toFixed(2)} toward ${giftLabel}`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Thank you for your contribution!</p>
        <div style="background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666; width: 100px;">Amount</td><td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #111;">$${data.amount.toFixed(2)}</td></tr>
            ${feeRow}
            ${ownerReceivesRow}
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Gift</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${giftLabel}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Date</td><td style="padding: 4px 0; font-size: 13px; color: #444;">${date}</td></tr>
          </table>
        </div>
        <p style="margin: 0; font-size: 13px; color: #666;">${data.owner.name || 'The recipient'} will be notified and can use these funds to purchase the gift.</p>
      `),
    }).catch((err) => console.error('Failed to send contributor email receipt:', err))
  }

  // WhatsApp to contributor (template: contribution_receipt)
  // Body: "Receipt: You contributed ${{2}} towards "{{3}}". {{1}} will be notified. Thank you!"
  if (data.contributor.phone) {
    sendTemplateMessage(
      data.contributor.phone,
      'contribution_receipt',
      [data.owner.name || 'The recipient', data.amount.toFixed(2), giftLabel]
    ).catch((err) => console.error('Failed to send contributor WhatsApp receipt:', err))

    // Follow up with fee note via text (within 24h window)
    if (data.feeAmount > 0) {
      sendTextMessage(
        data.contributor.phone,
        `Platform fee: $${data.feeAmount.toFixed(2)} (2%). ${data.owner.name || 'The recipient'} receives $${data.netAmount.toFixed(2)}.`
      ).catch(() => {})
    } else if (data.isFreeContribution) {
      sendTextMessage(
        data.contributor.phone,
        `Platform fee: $0.00 (free — ${data.freeRemaining} of 10 free contributions remaining for this recipient).`
      ).catch(() => {})
    }
  }

  // Small delay to avoid Resend rate limit (2 req/sec)
  await new Promise(r => setTimeout(r, 600))

  // ── Receipt to gift owner ──

  const displayName = data.isAnonymous ? 'Someone' : data.contributorName

  // Email to owner
  if (data.owner.email) {
    const ownerFeeRow = `<tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Platform fee</td><td style="padding: 4px 0; font-size: 13px; color: #166534;">${ownerFeeLabel(data)}</td></tr>`
    const addedRow = `<tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Added to balance</td><td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #166534;">+$${data.netAmount.toFixed(2)}</td></tr>`

    await sendEmail({
      to: data.owner.email,
      subject: `${displayName} contributed $${data.amount.toFixed(2)} toward ${giftLabel}`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">You received a contribution!</p>
        <div style="background: #f0fdf4; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534; width: 100px;">Contribution</td><td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #166534;">$${data.amount.toFixed(2)}</td></tr>
            ${ownerFeeRow}
            ${addedRow}
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">From</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${displayName}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Gift</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${giftLabel}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Date</td><td style="padding: 4px 0; font-size: 13px; color: #444;">${date}</td></tr>
          </table>
        </div>
        <a href="${viewUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px;">View &amp; Withdraw Funds</a>
      `),
    }).catch((err) => console.error('Failed to send owner email receipt:', err))
  }

  // WhatsApp to owner (template: contribution_received)
  // Body: "Great news! {{1}} contributed ${{2}} toward "{{3}}" on your Giftist wishlist. Your funds are ready to view and withdraw at giftist.ai/wallet"
  if (data.owner.phone) {
    sendTemplateMessage(
      data.owner.phone,
      'contribution_received',
      [displayName, data.amount.toFixed(2), giftLabel]
    ).catch((err) => console.error('Failed to send owner WhatsApp receipt:', err))

    // Follow up with fee note via text (within 24h window)
    if (data.feeAmount > 0) {
      sendTextMessage(
        data.owner.phone,
        `Fee note: $${data.feeAmount.toFixed(2)} (2%) platform fee. $${data.netAmount.toFixed(2)} added to your balance.`
      ).catch(() => {})
    } else if (data.isFreeContribution) {
      const used = 10 - data.freeRemaining
      sendTextMessage(
        data.owner.phone,
        `Fee note: $0.00 platform fee (free contribution ${used} of 10). Full $${data.netAmount.toFixed(2)} added to your balance.`
      ).catch(() => {})
    }
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

  const feeRows = data.fee > 0
    ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Fee</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">$${data.fee.toFixed(2)}</td></tr><tr><td style="padding: 4px 0; font-size: 13px; color: #666;">You receive</td><td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #111;">$${data.netAmount.toFixed(2)}</td></tr>`
    : ''

  // Email receipt
  if (data.user.email) {
    sendEmail({
      to: data.user.email,
      subject: `Withdrawal receipt — $${data.amount.toFixed(2)} to bank`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Withdrawal Confirmed</p>
        <div style="background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666; width: 90px;">Amount</td><td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #111;">$${data.amount.toFixed(2)}</td></tr>
            ${feeRows}
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Destination</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${methodDesc}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Reference</td><td style="padding: 4px 0; font-size: 13px; color: #444;">${data.transferId}</td></tr>
          </table>
        </div>
        <p style="margin: 0; font-size: 13px; color: #666;">${arrivalNote}</p>
      `),
    }).catch((err) => console.error('Failed to send withdrawal email receipt:', err))
  }

  // WhatsApp receipt
  if (data.user.phone) {
    const feeNote = data.fee > 0 ? ` ($${data.fee.toFixed(2)} fee, you receive $${data.netAmount.toFixed(2)})` : ''
    sendTextMessage(
      data.user.phone,
      `\u{1F4B0} Withdrawal confirmed: $${data.amount.toFixed(2)} to your bank account${feeNote}. ${arrivalNote} Ref: ${data.transferId}`
    ).catch((err) => console.error('Failed to send withdrawal WhatsApp receipt:', err))
  }
}
