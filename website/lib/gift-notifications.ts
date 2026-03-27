import { prisma } from './db'
import { smartWhatsAppSend, emailWrapper, notify } from './notifications'
import { sendSms } from './sms'
import { sendEmail } from './email'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://giftist.ai'

// ── 1. Notify recipient that a gift was sent ──

export async function notifyGiftReceived(giftSendId: string): Promise<void> {
  const gift = await prisma.giftSend.findUnique({
    where: { id: giftSendId },
    include: { sender: { select: { name: true } } },
  })

  if (!gift) {
    console.error(`[GiftNotify] GiftSend not found: ${giftSendId}`)
    return
  }

  const senderName = gift.sender.name || 'Someone'
  const claimUrl = `${BASE_URL}/gift/${gift.redeemCode}`
  const amountStr = `$${gift.amount.toFixed(2)}`
  const messageLine = gift.senderMessage ? `\n${gift.senderMessage}\n` : ''

  const textBody = [
    `${senderName} sent you a gift \u2014 ${gift.itemName} (${amountStr})!`,
    messageLine,
    `Tap to claim your gift: ${claimUrl}`,
  ].filter(Boolean).join('\n')

  // WhatsApp first — fall back to SMS only if WhatsApp fails
  if (gift.recipientPhone) {
    try {
      await smartWhatsAppSend(
        gift.recipientPhone,
        textBody,
        'gift_received',
        [senderName, gift.itemName, amountStr, claimUrl],
        { skipTimeCheck: true }
      )
    } catch (err) {
      console.error(`[GiftNotify] WhatsApp failed for ${giftSendId}, falling back to SMS:`, err)
      sendSms(gift.recipientPhone, textBody).catch((smsErr) =>
        console.error(`[GiftNotify] SMS also failed for ${giftSendId}:`, smsErr)
      )
    }
  }

  // No recipientEmail on GiftSend — skip email for now
}

// ── 1b. Send receipt to sender after payment ──

export async function sendGiftSendReceipt(giftSendId: string): Promise<void> {
  const gift = await prisma.giftSend.findUnique({
    where: { id: giftSendId },
    include: { sender: { select: { name: true, phone: true, email: true } } },
  })

  if (!gift) return

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const claimUrl = `${BASE_URL}/gift/${gift.redeemCode}`
  const recipientDisplay = gift.recipientName || 'your friend'

  // Email receipt to sender
  if (gift.sender.email) {
    sendEmail({
      to: gift.sender.email,
      subject: `Gift receipt — ${gift.itemName} for ${recipientDisplay}`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Gift sent!</p>
        <div style="background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666; width: 100px;">Gift</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${gift.itemName}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">To</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${recipientDisplay}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Amount</td><td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #111;">$${gift.amount.toFixed(2)}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Service fee</td><td style="padding: 4px 0; font-size: 13px; color: #666;">$${gift.platformFee.toFixed(2)}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Total charged</td><td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #111;">$${gift.totalCharged.toFixed(2)}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Date</td><td style="padding: 4px 0; font-size: 13px; color: #444;">${date}</td></tr>
          </table>
        </div>
        <p style="margin: 0 0 12px; font-size: 13px; color: #666;">Share the link below with ${recipientDisplay} to claim their gift:</p>
        <a href="${claimUrl}" style="display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px;">Gift claim link</a>
        <p style="margin: 12px 0 0; font-size: 11px; color: #999;">${claimUrl}</p>
      `),
    }).catch((err) => console.error('[GiftReceipt] Sender email failed:', err))
  }

  // WhatsApp / SMS to sender
  if (gift.sender.phone) {
    const text = `🎁 Gift sent! You sent "${gift.itemName}" ($${gift.amount.toFixed(2)}) to ${recipientDisplay}. Total charged: $${gift.totalCharged.toFixed(2)}. Share the claim link: ${claimUrl}`
    smartWhatsAppSend(
      gift.sender.phone,
      text,
      'gift_send_receipt',
      [gift.itemName, gift.amount.toFixed(2), recipientDisplay, claimUrl],
      { skipTimeCheck: true }
    ).catch((err) => {
      console.error('[GiftReceipt] Sender WhatsApp failed, trying SMS:', err)
      sendSms(gift.sender.phone!, text).catch(() => {})
    })
  }
}

// ── 1c. Send receipt to recipient after redemption ──

export async function sendGiftRedemptionReceipt(giftSendId: string, method: string, payoutAmount?: number): Promise<void> {
  const gift = await prisma.giftSend.findUnique({
    where: { id: giftSendId },
    include: {
      sender: { select: { name: true } },
      recipient: { select: { phone: true, email: true, name: true } },
    },
  })

  if (!gift) return

  const senderName = gift.sender.name || 'A friend'
  const recipientPhone = gift.recipient?.phone || gift.recipientPhone
  const recipientEmail = gift.recipient?.email
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  let methodDesc = ''
  let amountLine = ''
  if (method === 'PAYPAL' || method === 'VENMO') {
    methodDesc = method === 'VENMO' ? 'Venmo' : 'PayPal'
    const amt = payoutAmount ?? (gift.amount - 0.25)
    amountLine = `$${amt.toFixed(2)} sent to your ${methodDesc} account`
  } else if (method === 'WALLET') {
    methodDesc = 'Giftist wallet'
    amountLine = `$${gift.amount.toFixed(2)} added to your Giftist wallet — withdraw to bank for free`
  } else if (method === 'ITEM_CLICK') {
    amountLine = `You chose to buy "${gift.itemName}" directly`
  }

  // Email receipt to recipient
  if (recipientEmail) {
    sendEmail({
      to: recipientEmail,
      subject: `Gift redeemed — ${gift.itemName} from ${senderName}`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Gift redeemed!</p>
        <div style="background: #f0fdf4; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534; width: 100px;">Gift</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${gift.itemName}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">From</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #111;">${senderName}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Payout</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #166534;">${amountLine}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #166534;">Date</td><td style="padding: 4px 0; font-size: 13px; color: #444;">${date}</td></tr>
          </table>
        </div>
      `),
    }).catch((err) => console.error('[GiftReceipt] Recipient email failed:', err))
  }

  // WhatsApp / SMS to recipient
  if (recipientPhone) {
    const text = `✅ Gift redeemed! "${gift.itemName}" from ${senderName}. ${amountLine}.`
    smartWhatsAppSend(
      recipientPhone,
      text,
      'gift_redeemed_receipt',
      [gift.itemName, senderName, amountLine],
      { skipTimeCheck: true }
    ).catch((err) => {
      console.error('[GiftReceipt] Recipient WhatsApp failed, trying SMS:', err)
      sendSms(recipientPhone!, text).catch(() => {})
    })
  }
}

// ── 2. Schedule reminders for unclaimed gifts ──

export async function scheduleGiftReminders(giftSendId: string): Promise<void> {
  const gift = await prisma.giftSend.findUnique({
    where: { id: giftSendId },
    include: { sender: { select: { name: true } } },
  })

  if (!gift) {
    console.error(`[GiftNotify] GiftSend not found for reminders: ${giftSendId}`)
    return
  }

  const senderName = gift.sender.name || 'Someone'
  const claimUrl = `${BASE_URL}/gift/${gift.redeemCode}`

  const reminders = [
    {
      delayMs: 1 * 24 * 60 * 60 * 1000, // Day 1
      text: `You still have a gift from ${senderName} waiting \u2014 ${gift.itemName}. Tap to claim: ${claimUrl}`,
      dedupKey: `gift-remind-d1-${giftSendId}`,
    },
    {
      delayMs: 3 * 24 * 60 * 60 * 1000, // Day 3
      text: `Last reminder \u2014 ${senderName}'s gift is still waiting for you: ${claimUrl}`,
      dedupKey: `gift-remind-d3-${giftSendId}`,
    },
  ]

  for (const reminder of reminders) {
    const scheduledAt = new Date(Date.now() + reminder.delayMs)

    // Queue in MessageQueue — these are for non-users so we store the phone directly
    // The queue processor will pick them up at scheduledAt
    try {
      await prisma.messageQueue.create({
        data: {
          userId: gift.senderId, // attribute to sender (recipient may not exist yet)
          phone: gift.recipientPhone,
          email: null,
          subject: `Gift from ${senderName} waiting`,
          text: reminder.text,
          template: 'gift_reminder',
          vars: JSON.stringify([senderName, gift.itemName, claimUrl]),
          priority: 10, // high priority — transactional
          scheduledAt,
          dedupKey: reminder.dedupKey,
        },
      })
    } catch (err: any) {
      // P2002 = unique constraint (already queued), ignore
      if (err?.code === 'P2002') continue
      console.error(`[GiftNotify] Failed to queue reminder ${reminder.dedupKey}:`, err)
    }
  }
}

// ── 3. Cancel pending reminders (call when gift is redeemed) ──

export async function cancelGiftReminders(giftSendId: string): Promise<void> {
  await prisma.messageQueue.updateMany({
    where: {
      AND: [
        { dedupKey: { startsWith: 'gift-remind-' } },
        { dedupKey: { endsWith: `-${giftSendId}` } },
      ],
      status: 'QUEUED',
    },
    data: { status: 'SKIPPED' },
  })
}

// ── 4. Thank-you prompt after redemption ──

export async function sendThankYouPrompt(
  userId: string,
  senderName: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, email: true, name: true },
  })

  if (!user) {
    console.error(`[GiftNotify] User not found for thank-you prompt: ${userId}`)
    return
  }

  const textBody = `Welcome to Giftist! I have some recommendations for a thank-you gift back to ${senderName}. What's your budget? Or just tell me about them and I'll find something perfect.`

  // In-app notification
  await notify({
    userId,
    type: 'WELCOME',
    title: 'Send a thank-you gift?',
    body: textBody,
    whatsapp: user.phone ? {
      phone: user.phone,
      text: textBody,
      template: 'thank_you_prompt',
      templateParams: [senderName],
    } : undefined,
    email: user.email ? {
      to: user.email,
      subject: `Send a thank-you gift to ${senderName}?`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Welcome to Giftist!</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #444;">
          I have some recommendations for a thank-you gift back to <strong>${senderName}</strong>.
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; color: #444;">
          What's your budget? Or just tell me about them and I'll find something perfect.
        </p>
        <a href="${BASE_URL}/chat?q=${encodeURIComponent(`I want to send a thank-you gift to ${senderName}`)}" style="display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px;">Find a thank-you gift</a>
      `),
    } : undefined,
  })
}
