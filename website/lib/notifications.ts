import { prisma } from './db'
import { sendEmail } from './email'
import { sendTextMessage, sendTemplateMessage } from './whatsapp'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://giftist.ai'
const LOGO_URL = `${BASE_URL}/logo-light.png`

// ── Branded email wrapper (shared with receipts.ts) ──

export function emailWrapper(body: string): string {
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

// ── Messaging time window ──
// Proactive messages only during these windows (user's local time):
// Weekdays: 12pm-1pm and 5pm-10pm
// Saturday: all day
// Sunday: all day

function isWithinMessagingWindow(timezone?: string | null): boolean {
  const tz = timezone || 'America/New_York' // default to ET
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  })
  const parts = formatter.formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const weekday = parts.find(p => p.type === 'weekday')?.value || ''

  // Weekend: all day is fine
  if (weekday === 'Sat' || weekday === 'Sun') return true

  // Weekday windows: 12-1pm or 5-10pm
  if (hour === 12) return true // 12pm-1pm
  if (hour >= 17 && hour < 22) return true // 5pm-10pm

  return false
}

// ── Smart WhatsApp Send (24h window optimization + time gating) ──

export async function smartWhatsAppSend(
  phone: string,
  textBody: string,
  templateName: string,
  templateParams: string[],
  opts?: { timezone?: string | null; skipTimeCheck?: boolean }
): Promise<void> {
  if (!phone) return

  // Check messaging time window (skip for transactional/reply messages)
  if (!opts?.skipTimeCheck && !isWithinMessagingWindow(opts?.timezone)) {
    console.log(`[Notify] Skipping message to ${phone} — outside messaging window`)
    return
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentInbound = await prisma.whatsAppMessage.findFirst({
    where: {
      phone,
      createdAt: { gte: cutoff },
      type: { notIn: ['OUTBOUND', 'OUTBOUND_TEMPLATE'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recentInbound) {
    await sendTextMessage(phone, textBody)
  } else {
    await sendTemplateMessage(phone, templateName, templateParams)
  }
}

// ── Core notify() dispatcher ──

export type NotificationType =
  | 'CONTRIBUTION_COMPLETED'
  | 'CONTRIBUTION_RECEIVED'
  | 'WITHDRAWAL'
  | 'ITEM_PURCHASED'
  | 'THANK_YOU_SENT'
  | 'WELCOME'
  | 'LIST_VIEWED'
  | 'EVENT_CREATED'
  | 'EVENT_EDITED'
  | 'EVENT_DELETED'
  | 'ITEM_ADDED'
  | 'ITEM_EDITED'
  | 'ITEM_DELETED'
  | 'FUNDS_ALLOCATED'
  | 'FUNDS_MOVED'

interface NotifyOptions {
  userId: string
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, any>
  email?: {
    to: string
    subject: string
    html: string
  }
  whatsapp?: {
    phone: string
    text: string
    template: string
    templateParams: string[]
  }
}

export async function notify(opts: NotifyOptions): Promise<void> {
  // 1. Create in-app notification
  await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      channel: opts.email && opts.whatsapp ? 'ALL' : opts.email ? 'EMAIL' : opts.whatsapp ? 'WHATSAPP' : 'IN_APP',
    },
  })

  // 2. Send email (fire-and-forget)
  if (opts.email) {
    sendEmail(opts.email).catch((err) =>
      console.error(`[Notify] Email failed for ${opts.type}:`, err)
    )
  }

  // 3. Send WhatsApp (fire-and-forget)
  // Transactional notifications (contributions, purchases, etc.) skip time window check
  if (opts.whatsapp) {
    smartWhatsAppSend(
      opts.whatsapp.phone,
      opts.whatsapp.text,
      opts.whatsapp.template,
      opts.whatsapp.templateParams,
      { skipTimeCheck: true }
    ).catch((err) =>
      console.error(`[Notify] WhatsApp failed for ${opts.type}:`, err)
    )
  }
}

// ── Per-action notification helpers ──

export async function notifyWelcome(userId: string, email?: string | null, phone?: string | null, name?: string | null) {
  const displayName = name || 'there'
  await notify({
    userId,
    type: 'WELCOME',
    title: 'Welcome to The Giftist!',
    body: `Hi ${displayName}! Your AI Gift Concierge is ready to help you find the perfect gifts.`,
    email: email ? {
      to: email,
      subject: 'Welcome to The Giftist!',
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Welcome to The Giftist!</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #444;">Hi ${displayName}, I'm your AI Gift Concierge. Here's how it works:</p>
        <ol style="margin: 0 0 16px; padding-left: 20px; font-size: 14px; color: #444;">
          <li><strong>Save items</strong> — Send a link or photo and I'll add it to your wishlist</li>
          <li><strong>Link to events</strong> — Tell me about birthdays, holidays, or celebrations</li>
          <li><strong>Add your circle</strong> — Share phone numbers of friends and family</li>
          <li><strong>They contribute</strong> — Your circle sees your wishlist and can chip in</li>
        </ol>
        <p style="margin: 0 0 16px; font-size: 14px; color: #444;">I've already set up events for Christmas, Mother's Day, Father's Day, and more!</p>
        <a href="${BASE_URL}" style="display: inline-block; background: #111; color: white; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px;">Get Started</a>
      `),
    } : undefined,
    whatsapp: phone ? {
      phone,
      text: `Hi ${displayName}! Welcome to The Giftist — I'm your personal gift concierge.\n\nHere's how it works:\n1. *Save items* — Send me a link or photo and I'll add it to your wishlist\n2. *Link to events* — Tell me about birthdays, holidays, or celebrations\n3. *Add your circle* — Share phone numbers of friends and family\n4. *They contribute* — Your circle sees your wishlist and can chip in\n\nI've already set up events for Christmas, Mother's Day, Father's Day, and more — type *events* to see them!\n\nTry it now — send me a link to something you've been eyeing!`,
      template: 'welcome_message',
      templateParams: [displayName],
    } : undefined,
  })
}

export async function notifyListViewed(ownerId: string, viewerName: string) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { phone: true, name: true },
  })
  const displayName = owner?.name || 'there'
  await notify({
    userId: ownerId,
    type: 'LIST_VIEWED',
    title: 'Someone viewed your wishlist',
    body: `${viewerName} just checked out your wishlist.`,
    metadata: { viewerName },
    whatsapp: owner?.phone ? {
      phone: owner.phone,
      text: `${viewerName} just viewed your wishlist! Make sure it's up to date at giftist.ai`,
      template: 'list_viewed_wa',
      templateParams: [displayName, viewerName],
    } : undefined,
  })
}

export async function notifyEventCreated(userId: string, eventName: string, eventId: string) {
  await notify({
    userId,
    type: 'EVENT_CREATED',
    title: 'Event created',
    body: `"${eventName}" has been added to your events.`,
    metadata: { eventId },
  })
}

export async function notifyEventEdited(userId: string, eventName: string, eventId: string) {
  await notify({
    userId,
    type: 'EVENT_EDITED',
    title: 'Event updated',
    body: `"${eventName}" has been updated.`,
    metadata: { eventId },
  })
}

export async function notifyEventDeleted(userId: string, eventName: string) {
  await notify({
    userId,
    type: 'EVENT_DELETED',
    title: 'Event deleted',
    body: `"${eventName}" has been removed from your events.`,
  })
}

export async function notifyItemAdded(userId: string, itemName: string, itemId: string) {
  await notify({
    userId,
    type: 'ITEM_ADDED',
    title: 'Item added',
    body: `"${itemName}" has been added to your wishlist.`,
    metadata: { itemId },
  })
}

export async function notifyItemEdited(userId: string, itemName: string, itemId: string) {
  await notify({
    userId,
    type: 'ITEM_EDITED',
    title: 'Item updated',
    body: `"${itemName}" has been updated.`,
    metadata: { itemId },
  })
}

export async function notifyItemDeleted(userId: string, itemName: string) {
  await notify({
    userId,
    type: 'ITEM_DELETED',
    title: 'Item removed',
    body: `"${itemName}" has been removed from your wishlist.`,
  })
}

export async function notifyItemPurchased(
  ownerId: string,
  itemName: string,
  itemId: string,
  ownerEmail?: string | null
) {
  await notify({
    userId: ownerId,
    type: 'ITEM_PURCHASED',
    title: 'Item marked as purchased',
    body: `"${itemName}" has been marked as purchased!`,
    metadata: { itemId },
    email: ownerEmail ? {
      to: ownerEmail,
      subject: `"${itemName}" marked as purchased`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Item Purchased!</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #444;">"${itemName}" has been marked as purchased. Don't forget to send thank-you notes to your contributors!</p>
        <a href="${BASE_URL}/items/${itemId}" style="display: inline-block; background: #111; color: white; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px;">View Item</a>
      `),
    } : undefined,
  })
}

export async function notifyFundsAllocated(userId: string, amount: number, itemName: string, itemId: string) {
  await notify({
    userId,
    type: 'FUNDS_ALLOCATED',
    title: 'Funds allocated',
    body: `$${amount.toFixed(2)} allocated to "${itemName}" from your wallet.`,
    metadata: { itemId, amount },
  })
}

export async function notifyFundsMoved(userId: string, amount: number, itemName: string) {
  await notify({
    userId,
    type: 'FUNDS_MOVED',
    title: 'Funds moved to wallet',
    body: `$${amount.toFixed(2)} from "${itemName}" moved to your wallet.`,
    metadata: { amount },
  })
}

export async function notifyContributionCompleted(
  userId: string,
  amount: number,
  giftLabel: string,
  metadata?: Record<string, any>
) {
  await notify({
    userId,
    type: 'CONTRIBUTION_COMPLETED',
    title: 'Contribution confirmed',
    body: `Your $${amount.toFixed(2)} contribution toward "${giftLabel}" is confirmed.`,
    metadata,
  })
}

export async function notifyContributionReceived(
  userId: string,
  contributorName: string,
  amount: number,
  giftLabel: string,
  metadata?: Record<string, any>
) {
  await notify({
    userId,
    type: 'CONTRIBUTION_RECEIVED',
    title: 'You received a contribution!',
    body: `${contributorName} contributed $${amount.toFixed(2)} toward "${giftLabel}".`,
    metadata,
  })
}

export async function notifyWithdrawal(
  userId: string,
  amount: number,
  method: string
) {
  await notify({
    userId,
    type: 'WITHDRAWAL',
    title: 'Withdrawal confirmed',
    body: `$${amount.toFixed(2)} withdrawal to your bank account (${method}) is being processed.`,
    metadata: { amount, method },
  })
}

export async function notifyThankYouSent(
  contributorId: string,
  ownerName: string,
  itemName: string,
  message: string,
  contributorEmail?: string | null
) {
  await notify({
    userId: contributorId,
    type: 'THANK_YOU_SENT',
    title: `Thank you from ${ownerName}`,
    body: message || `${ownerName} sent you a thank-you note for your contribution to "${itemName}".`,
    metadata: { itemName },
    email: contributorEmail ? {
      to: contributorEmail,
      subject: `${ownerName} sent you a thank you!`,
      html: emailWrapper(`
        <p style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #111;">Thank You Note</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #444;">${ownerName} sent you a thank-you for your contribution to "${itemName}":</p>
        <div style="background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 14px; color: #111; font-style: italic;">"${message}"</p>
        </div>
        <a href="${BASE_URL}" style="display: inline-block; background: #111; color: white; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px;">Visit The Giftist</a>
      `),
    } : undefined,
  })
}
