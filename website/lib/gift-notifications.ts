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
