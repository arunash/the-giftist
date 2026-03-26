import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './db'
import { logApiCall } from './api-logger'
import { smartWhatsAppSend } from './notifications'
import { sendSms } from './sms'
import { sendEmail } from './email'
import { getSlugForHoliday } from './holiday-slugs'

const anthropic = new Anthropic()

interface FunnelState {
  welcome?: boolean
  firstItem?: boolean
  thirdItemEventNudge?: boolean
  day1Nudge?: boolean
  day3EventPrompt?: boolean
  day5CirclePrompt?: boolean
  weeklyDigestSent?: string // ISO date of last weekly digest
  reengagementSent?: string // ISO date of last re-engagement
  goldDailySent?: string // ISO date of last Gold daily message
  eventNudgesSent?: string[] // event IDs already nudged for countdown
  postEventSent?: Record<string, string> // eventId → 'thanked' | 'reminded'
  seasonalSent?: Record<string, boolean> // 'holiday_year' → true
  returningWelcomeBack?: string // ISO date of last welcome-back
  matureFeatureDiscovery?: string // ISO date
  churned30Sent?: string // ISO date
  churned60Sent?: string // ISO date
  // New funnel stages
  day1GiftDna?: boolean
  day3MothersDay?: boolean
  day7GiftSend?: boolean
  day14LastChance?: boolean
  day30Winback?: boolean
}

function parseFunnelStage(raw: string | null): FunnelState {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

// ── Send via all available channels: WhatsApp + SMS + Email ──

async function sendToAllChannels(
  user: { phone: string | null; email: string | null },
  subject: string,
  text: string,
  template: string,
  vars: string[],
  options?: { emailHtml?: string }
) {
  // WhatsApp first — fall back to SMS only if WhatsApp fails
  if (user.phone) {
    let whatsappOk = false
    try {
      await smartWhatsAppSend(user.phone, text, template, vars)
      whatsappOk = true
    } catch {
      // WhatsApp failed — fall back to SMS
    }
    if (!whatsappOk) {
      const smsText = text.length > 300 ? text.slice(0, 297) + '...' : text
      await sendSms(user.phone, smsText + '\n\nReply STOP to opt out.').catch(() => {})
    }
  }
  // Email always goes out
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject,
      html: options?.emailHtml || `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <p style="color: #333; line-height: 1.6; white-space: pre-line;">${text}</p>
          <div style="margin: 24px 0;">
            <a href="https://giftist.ai/chat" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Chat with your Gift Concierge
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">The Giftist — <a href="https://giftist.ai" style="color: #999;">giftist.ai</a></p>
        </div>
      `,
    }).catch(() => {})
  }
}

// ── Message Queue Helpers ──

function getNext5pm(timezone: string | null): Date {
  const tz = timezone || 'America/New_York'
  const now = new Date()
  // Get current time in user's timezone
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  // Set to 5pm today
  const target = new Date(userNow)
  target.setHours(17, 0, 0, 0)
  // If already past 5pm, schedule for tomorrow
  if (userNow >= target) {
    target.setDate(target.getDate() + 1)
  }
  // Convert back to UTC
  const offset = userNow.getTime() - now.getTime()
  return new Date(target.getTime() - offset)
}

function getStartOfWeek(date: Date, timezone: string): Date {
  const tz = timezone || 'America/New_York'
  const localStr = date.toLocaleString('en-US', { timeZone: tz })
  const local = new Date(localStr)
  const dayOfWeek = local.getDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  local.setDate(local.getDate() + mondayOffset)
  local.setHours(0, 0, 0, 0)
  // Convert back to UTC
  const offset = new Date(date.toLocaleString('en-US', { timeZone: tz })).getTime() - date.getTime()
  return new Date(local.getTime() - offset)
}

function getNextMonday5pm(date: Date, timezone: string): Date {
  const tz = timezone || 'America/New_York'
  const localStr = date.toLocaleString('en-US', { timeZone: tz })
  const local = new Date(localStr)
  const dayOfWeek = local.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
  local.setDate(local.getDate() + daysUntilMonday)
  local.setHours(17, 0, 0, 0)
  const offset = new Date(date.toLocaleString('en-US', { timeZone: tz })).getTime() - date.getTime()
  return new Date(local.getTime() - offset)
}

async function queueMessage(params: {
  userId: string,
  phone: string | null,
  email: string | null,
  timezone: string | null,
  subject: string,
  text: string,
  template: string,
  vars: string[],
  emailHtml?: string,
  priority: number,
  dedupKey: string,
  expiresAt?: Date, // holiday messages expire on the holiday date
}) {
  const scheduledAt = getNext5pm(params.timezone)
  try {
    await prisma.messageQueue.create({
      data: {
        userId: params.userId,
        phone: params.phone,
        email: params.email,
        subject: params.subject,
        text: params.text,
        template: params.template,
        vars: JSON.stringify(params.vars),
        emailHtml: params.emailHtml,
        priority: params.priority,
        scheduledAt,
        expiresAt: params.expiresAt,
        dedupKey: params.dedupKey,
      },
    })
  } catch (err: any) {
    // Unique constraint violation = already queued, ignore
    if (err?.code === 'P2002') return
    throw err
  }
}

// ── Message Queue Processor (called by cron after queueing) ──
//
// Rules:
// 1. Max 2 messages per week (Mon-Sun), min 1 day apart
// 2. Holiday messages (have expiresAt) take precedence — they bypass the
//    weekly cap if they'd expire before the next available slot
// 3. Expired messages (expiresAt < now) are auto-skipped
// 4. Non-expiring messages (funnel/lifecycle) can be delayed indefinitely

export async function processMessageQueue() {
  const now = new Date()
  const results = { sent: 0, deferred: 0, expired: 0 }

  // Step 1: Auto-skip expired messages
  const { count: expiredCount } = await prisma.messageQueue.updateMany({
    where: {
      status: 'QUEUED',
      expiresAt: { not: null, lt: now },
    },
    data: { status: 'SKIPPED' },
  })
  results.expired = expiredCount

  // Step 2: Get all queued messages ready to send
  const readyMessages = await prisma.messageQueue.findMany({
    where: {
      status: 'QUEUED',
      scheduledAt: { lte: now },
    },
    orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
    include: { user: { select: { timezone: true } } },
  })

  // Group by user
  const byUser = new Map<string, typeof readyMessages>()
  for (const msg of readyMessages) {
    const list = byUser.get(msg.userId) || []
    list.push(msg)
    byUser.set(msg.userId, list)
  }

  for (const [userId, messages] of Array.from(byUser.entries())) {
    const tz = messages[0].user.timezone || 'America/New_York'

    // Check last sent message for this user
    const lastSent = await prisma.messageQueue.findFirst({
      where: { userId, status: 'SENT' },
      orderBy: { sentAt: 'desc' },
    })

    const hoursSinceLastSent = lastSent?.sentAt
      ? (now.getTime() - lastSent.sentAt.getTime()) / (1000 * 60 * 60)
      : 999

    // Count messages sent this week
    const startOfWeek = getStartOfWeek(now, tz)
    const sentThisWeek = await prisma.messageQueue.count({
      where: {
        userId,
        status: 'SENT',
        sentAt: { gte: startOfWeek },
      },
    })

    const rateLimitOk = hoursSinceLastSent >= 24 && sentThisWeek < 2

    // Separate time-sensitive (holiday) vs deferrable messages
    const urgent = messages.filter(m => m.expiresAt != null)
    const deferrable = messages.filter(m => m.expiresAt == null)

    // Pick the best message to send
    // Priority: urgent expiring soonest > highest priority urgent > highest priority deferrable
    let toSend: typeof messages[0] | null = null

    if (rateLimitOk) {
      // Normal case: send highest priority message (already sorted)
      toSend = messages[0]
    } else if (hoursSinceLastSent >= 24 && urgent.length > 0) {
      // Rate limit exceeded but we have urgent holiday messages —
      // bypass weekly cap for holidays that would expire before next week
      const nextMonday = getNextMonday5pm(now, tz)
      const expiringBeforeNextWeek = urgent.filter(m => m.expiresAt! < nextMonday)
      if (expiringBeforeNextWeek.length > 0) {
        // Send the most urgent one (highest priority, then soonest expiry)
        expiringBeforeNextWeek.sort((a, b) => b.priority - a.priority || a.expiresAt!.getTime() - b.expiresAt!.getTime())
        toSend = expiringBeforeNextWeek[0]
      }
    }

    if (!toSend) {
      // Can't send anything — reschedule deferrables to next available slot
      results.deferred += messages.length
      if (sentThisWeek >= 2) {
        const nextMonday5pm = getNextMonday5pm(now, tz)
        for (const msg of deferrable) {
          await prisma.messageQueue.update({
            where: { id: msg.id },
            data: { scheduledAt: nextMonday5pm },
          })
        }
      }
      continue
    }

    // Send the message
    const vars = JSON.parse(toSend.vars) as string[]
    await sendToAllChannels(
      { phone: toSend.phone, email: toSend.email },
      toSend.subject,
      toSend.text,
      toSend.template,
      vars,
      toSend.emailHtml ? { emailHtml: toSend.emailHtml } : undefined
    )

    await prisma.messageQueue.update({
      where: { id: toSend.id },
      data: { status: 'SENT', sentAt: now },
    })
    results.sent++
    results.deferred += messages.length - 1
  }

  console.log(`[MessageQueue] Processed: ${results.sent} sent, ${results.deferred} deferred, ${results.expired} expired`)
  return results
}

// ── Called after each inbound WhatsApp message ──

export async function checkAndSendFunnelMessages(userId: string, phone: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      funnelStage: true,
      createdAt: true,
      _count: { select: { items: { where: { source: { not: 'SEED' } } }, events: true, circleMembers: true } },
    },
  })
  if (!user) return

  const state = parseFunnelStage(user.funnelStage)

  // Stage 1: Welcome (first interaction, not yet sent)
  if (!state.welcome) {
    state.welcome = true
    await updateFunnelStage(userId, state)
    // Welcome is handled by notifyWelcome in auth.ts, no duplicate here
    return
  }

  // Stage 2: First item saved (check if they just saved their first item)
  if (!state.firstItem && user._count.items >= 1) {
    state.firstItem = true
    await updateFunnelStage(userId, state)
    // The firstItem nudge is sent from whatsapp-handlers after item save
  }
}

// ── Called after an item is saved via WhatsApp ──

export async function sendFirstItemNudge(userId: string, phone: string, itemName: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { funnelStage: true },
  })
  if (!user) return

  const state = parseFunnelStage(user.funnelStage)
  if (state.firstItem) return // already sent

  state.firstItem = true
  await updateFunnelStage(userId, state)

  const text = `Nice! "${itemName}" is saved to your list. Want me to find more gifts like this? Just tell me who you're shopping for!`
  await smartWhatsAppSend(phone, text, 'welcome_message', [itemName]).catch(() => {})
}

// ── Cron job handlers (called from /api/cron/whatsapp-engagement) ──

export async function runDailyEngagement() {
  const now = new Date()
  const results = { giftDnaPitch: 0, mothersDayHook: 0, giftSendPitch: 0, lastChance: 0, winback: 0 }

  // Find all users with phone or email who haven't opted out
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      digestOptOut: false,
      OR: [
        { phone: { not: null } },
        { email: { not: null } },
      ],
    },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      timezone: true,
      funnelStage: true,
      createdAt: true,
      _count: { select: { items: { where: { source: { not: 'SEED' } } }, events: true, circleMembers: true } },
    },
  })

  for (const user of users) {
    if (!user.phone && !user.email) continue
    const state = parseFunnelStage(user.funnelStage)
    const displayName = user.name || 'there'
    const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))

    // Find last inbound message time for inactivity checks
    let daysSinceLastMessage = daysSinceSignup
    if (user.phone) {
      const lastMessage = await prisma.whatsAppMessage.findFirst({
        where: { phone: user.phone },
        orderBy: { createdAt: 'desc' },
      })
      if (lastMessage) {
        daysSinceLastMessage = Math.floor((now.getTime() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      }
    }

    try {
      // Day 1: Gift DNA pitch (24h after signup, no Gift DNA created yet)
      // Feature spotlight: Gift DNA + AI Chat
      if (!state.day1GiftDna && daysSinceSignup >= 1) {
        const giftDnaCount = await prisma.circleMember.count({
          where: { userId: user.id, tasteProfile: { not: null } },
        })
        if (giftDnaCount === 0) {
          state.day1GiftDna = true
          const text = `Hey ${displayName}! Here are two ways I can find the perfect gift for you:\n\n1. *Gift DNA* — Export a WhatsApp chat and send it here. I'll build a full profile — interests, brands, wish statements — plus 3 personalized gift recommendations. Takes 30 seconds.\n\n2. *AI Chat* — Tell me who you're shopping for and I'll send you personalized recommendations. Example: "I need a birthday gift for my sister who loves cooking"\n\nhttps://giftist.ai/dna`
          await queueMessage({
            userId: user.id,
            phone: user.phone,
            email: user.email,
            timezone: user.timezone,
            subject: 'Two ways to find the perfect gift',
            text,
            template: 'day1_gift_dna',
            vars: [displayName],
            priority: 3,
            dedupKey: `day1_gift_dna_${user.id}`,
          })
          results.giftDnaPitch++
          await updateFunnelStage(user.id, state)
          continue
        } else {
          // Already has Gift DNA, skip this stage
          state.day1GiftDna = true
          await updateFunnelStage(user.id, state)
        }
      }

      // Day 3: Mother's Day + Photo upload
      // Feature spotlight: Photo upload + Holiday calendar
      if (!state.day3MothersDay && daysSinceSignup >= 3) {
        state.day3MothersDay = true
        const text = `Mother's Day is May 11 — I have some recommendations ready for you.\n\nPro tip: *Send me a photo* of something your mom mentioned wanting, or a screenshot from a store — I'll identify it and find where to buy it.\n\nTell me about her and I'll send you 3 personalized gift recommendations: https://giftist.ai/mothers-day`
        await queueMessage({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          timezone: user.timezone,
          subject: "Mother's Day is coming up",
          text,
          template: 'day3_mothers_day',
          vars: [displayName],
          priority: 3,
          dedupKey: `day3_mothers_day_${user.id}`,
        })
        results.mothersDayHook++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Day 7: Gift registry sharing + gift sending
      // Feature spotlight: Sharing gift registry + Gift sending
      if (!state.day7GiftSend && daysSinceSignup >= 7) {
        state.day7GiftSend = true
        const text = `Hey ${displayName}! Here are two more things I can do for you:\n\n*Shareable gift registry* — I'll create a wishlist you can share with friends and family. They can contribute or buy directly from the link.\n\n*Send gifts directly* — Pick a gift, pay, and your friend gets a message to redeem it. Just say "send a gift to Mom" and I'll handle the rest.`
        await queueMessage({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          timezone: user.timezone,
          subject: 'Share your wishlist + send gifts directly',
          text,
          template: 'day7_gift_send',
          vars: [displayName],
          priority: 3,
          dedupKey: `day7_gift_send_${user.id}`,
        })
        results.giftSendPitch++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Day 14: Low pressure utility — highlight all features
      // Feature spotlight: Full feature roundup
      if (!state.day14LastChance && daysSinceLastMessage >= 14) {
        state.day14LastChance = true
        const text = `Hey ${displayName} — here's everything I can do for you:\n\n- *AI Chat* — Tell me who you're shopping for, I'll send recommendations\n- *Gift DNA* — Send a chat export, I'll decode exactly what they want\n- *Photo upload* — Send me a photo, I'll find where to buy it\n- *Gift registry* — I'll create a shareable wishlist for you\n- *Holiday reminders* — I'll message you before every occasion with recommendations\n\nJust text me anytime.`
        await queueMessage({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          timezone: user.timezone,
          subject: 'Your Gift Concierge is always here',
          text,
          template: 'day14_last_chance',
          vars: [displayName],
          priority: 3,
          dedupKey: `day14_last_chance_${user.id}`,
        })
        results.lastChance++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Day 30: Win-back with features (30 days inactive)
      // Feature spotlight: Gift DNA + Holiday calendar
      if (!state.day30Winback && daysSinceLastMessage >= 30 && daysSinceLastMessage < 45) {
        state.day30Winback = true
        const text = `Giftist here — a few things you might have missed:\n\n*Gift DNA* — Send me a WhatsApp chat export and I'll build a full profile of what someone wants, plus 3 gift recommendations: https://giftist.ai/dna\n\n*Holiday reminders* — I'll message you 2 weeks before every holiday with personalized recommendations so you're never scrambling.\n\nSave my number — next time you need a gift, just text me.`
        await queueMessage({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          timezone: user.timezone,
          subject: 'New on Giftist: Gift DNA + Holiday reminders',
          text,
          template: 'day30_winback',
          vars: [displayName],
          priority: 3,
          dedupKey: `day30_winback_${user.id}`,
        })
        results.winback++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Event countdown nudge (3-7 days before event)
      const upcomingCountdownEvents = await prisma.event.findMany({
        where: {
          userId: user.id,
          date: {
            gte: new Date(now.getTime() + 3 * 86400000),
            lte: new Date(now.getTime() + 7 * 86400000),
          },
        },
        include: { _count: { select: { items: true } } },
      })

      const nudgedIds = state.eventNudgesSent || []
      for (const evt of upcomingCountdownEvents) {
        if (nudgedIds.includes(evt.id)) continue
        const days = Math.ceil((evt.date.getTime() - now.getTime()) / 86400000)
        const text = `Hey ${displayName}! ${evt.name} is ${days} days away.${
          evt._count.items === 0
            ? " You haven't added any gift ideas yet — want me to help you find something perfect?"
            : ` You have ${evt._count.items} item(s) lined up. Need any last-minute additions?`
        }`
        await queueMessage({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          timezone: user.timezone,
          subject: `${evt.name} is ${days} days away!`,
          text,
          template: 'event_countdown',
          vars: [displayName, evt.name, String(days)],
          priority: 5,
          dedupKey: `event_countdown_${evt.id}_${user.id}`,
          expiresAt: evt.date, // auto-skip if delayed past the event
        })
        nudgedIds.push(evt.id)
        state.eventNudgesSent = nudgedIds
        await updateFunnelStage(user.id, state)
      }
    } catch (err) {
      console.error(`[Funnel] Error processing user ${user.id}:`, err)
    }
  }

  return results
}

// ── Gold Daily AI-Personalized Messages ──

const GOLD_DAILY_SYSTEM = `You are a personal gift concierge sending a brief daily WhatsApp check-in. Max 2-3 sentences. Be warm, specific, and actionable. Reference their events/items by name when available. End with a question or suggestion they can reply to. Do NOT use emojis excessively — one or two max. Do NOT include links. NEVER assume gender of anyone — if unsure, use gender-neutral language.`

export async function runGoldDailyEngagement() {
  const now = new Date()
  const results = { sent: 0, skipped: 0, errors: 0 }

  // Find active Gold members with phone numbers
  const goldUsers = await prisma.user.findMany({
    where: {
      phone: { not: null },
      isActive: true,
      digestOptOut: false,
      subscription: {
        status: 'ACTIVE',
        currentPeriodEnd: { gt: now },
      },
    },
    select: {
      id: true,
      phone: true,
      name: true,
      interests: true,
      timezone: true,
      funnelStage: true,
      _count: { select: { items: { where: { source: { not: 'SEED' } } }, events: true, circleMembers: true } },
    },
  })

  // Process in batches of 5
  for (let i = 0; i < goldUsers.length; i += 5) {
    const batch = goldUsers.slice(i, i + 5)

    await Promise.all(batch.map(async (user) => {
      if (!user.phone) { results.skipped++; return }

      const state = parseFunnelStage(user.funnelStage)
      const todayStr = toUserLocalDate(now, user.timezone)

      // Skip if already sent today in user's timezone
      if (state.goldDailySent === todayStr) {
        results.skipped++
        return
      }

      try {
        // Gather context for Claude
        const upcomingEvents = await prisma.event.findMany({
          where: {
            userId: user.id,
            date: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { date: 'asc' },
          take: 5,
          select: { name: true, date: true },
        })

        const recentItems = await prisma.item.findMany({
          where: { userId: user.id },
          orderBy: { addedAt: 'desc' },
          take: 5,
          select: { name: true, price: true },
        })

        const wallet = await prisma.wallet.findUnique({
          where: { userId: user.id },
          select: { balance: true },
        })

        // Build compact context
        const displayName = user.name || 'there'
        const eventCtx = upcomingEvents.length > 0
          ? upcomingEvents.map(e => {
              const days = Math.ceil((e.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              return `${e.name} (${days}d away)`
            }).join(', ')
          : 'none'
        const itemCtx = recentItems.length > 0
          ? recentItems.map(i => `${i.name}${i.price ? ` ($${i.price})` : ''}`).join(', ')
          : 'none'

        const contextMsg = [
          `Name: ${displayName}`,
          `Upcoming events (next 30d): ${eventCtx}`,
          `Recent wishlist items: ${itemCtx}`,
          `Total items: ${user._count.items}, events: ${user._count.events}, circle members: ${user._count.circleMembers}`,
          user.interests ? `Interests: ${user.interests}` : null,
          wallet?.balance ? `Wallet balance: $${wallet.balance.toFixed(2)}` : null,
        ].filter(Boolean).join('\n')

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: GOLD_DAILY_SYSTEM,
          messages: [{ role: 'user', content: contextMsg }],
        })

        const messageText = response.content[0].type === 'text'
          ? response.content[0].text
          : ''

        if (!messageText) {
          results.errors++
          return
        }

        await logApiCall({
          provider: 'ANTHROPIC',
          endpoint: 'messages',
          model: 'claude-haiku-4-5-20251001',
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          userId: user.id,
          source: 'gold-daily-engagement',
        })

        await queueMessage({
          userId: user.id,
          phone: user.phone,
          email: null,
          timezone: user.timezone,
          subject: 'Your daily gift update',
          text: messageText,
          template: 'gold_daily',
          vars: [displayName],
          priority: 5,
          dedupKey: `gold_daily_${user.id}_${todayStr}`,
        })

        state.goldDailySent = todayStr
        await updateFunnelStage(user.id, state)
        results.sent++
        console.log(`[GoldDaily] Queued for user ${user.id}`)
      } catch (err) {
        console.error(`[GoldDaily] Error for user ${user.id}:`, err)
        results.errors++
      }
    }))

    // 2s delay between batches to pace Claude API calls
    if (i + 5 < goldUsers.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log(`[GoldDaily] Done: ${results.sent} queued, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

// ── Proactive Circle Member Event Reminders ──

export async function runCircleEventReminders() {
  const now = new Date()
  const results = { sent: 0, skipped: 0, errors: 0 }

  const cadences = [
    { label: '14d', minDays: 13, maxDays: 15 },
    { label: '7d',  minDays: 6,  maxDays: 8 },
    { label: '3d',  minDays: 2,  maxDays: 4 },
    { label: '1d',  minDays: 0,  maxDays: 1 },
  ]

  // Find all events in the next 16 days with their owner's circle
  const events = await prisma.event.findMany({
    where: {
      date: {
        gte: now,
        lte: new Date(now.getTime() + 16 * 86400000),
      },
    },
    include: {
      user: {
        select: {
          name: true, shareId: true, isActive: true, digestOptOut: true, timezone: true,
          circleMembers: { select: { phone: true, name: true } },
        },
      },
      items: {
        include: { item: { select: { name: true, price: true } } },
        orderBy: { priority: 'asc' },
        take: 3,
      },
      circleReminders: true,
    },
  })

  for (const event of events) {
    // Skip if owner opted out or has no circle
    if (!event.user.isActive || event.user.digestOptOut) continue
    if (event.user.circleMembers.length === 0) continue

    const daysUntil = Math.ceil((event.date.getTime() - now.getTime()) / 86400000)

    // Determine which cadence applies right now
    const cadence = cadences.find(c => daysUntil >= c.minDays && daysUntil <= c.maxDays)
    if (!cadence) continue

    const ownerName = event.user.name || 'Your friend'
    const shareUrl = `https://giftist.ai/events/${event.shareUrl}`
    const itemLines = event.items
      .map(ei => {
        const price = ei.item.price ? ` — ${ei.item.price}` : ''
        return `• ${ei.item.name}${price}`
      })
      .join('\n')

    for (const member of event.user.circleMembers) {
      // Dedup check
      const alreadySent = event.circleReminders.some(
        r => r.phone === member.phone && r.cadence === cadence.label
      )
      if (alreadySent) { results.skipped++; continue }

      const memberName = member.name || 'Hey there'

      // Build urgency-appropriate text
      let text: string
      if (daysUntil <= 1) {
        text = `${memberName} — ${ownerName}'s ${event.name} is tomorrow!`
      } else {
        text = `Hey ${memberName}! ${ownerName}'s ${event.name} is ${daysUntil} days away.`
      }
      if (itemLines) {
        text += `\n\nHere are some gift ideas they'd love:\n${itemLines}`
      }
      text += `\n\nBrowse the full wishlist: ${shareUrl}`

      try {
        // We need a userId for queueMessage — look up by phone or use the event owner
        // Circle members may not be registered users, so we queue via the event owner's userId
        // but send to the member's phone
        await queueMessage({
          userId: event.userId,
          phone: member.phone,
          email: null,
          timezone: event.user.timezone,
          subject: `${ownerName}'s ${event.name} is ${daysUntil} days away!`,
          text,
          template: 'circle_event_reminder',
          vars: [memberName, ownerName, event.name, String(daysUntil), shareUrl],
          priority: 7,
          dedupKey: `circle_reminder_${event.id}_${member.phone}_${cadence.label}`,
        })

        await prisma.circleEventReminder.create({
          data: { eventId: event.id, phone: member.phone, cadence: cadence.label },
        })
        results.sent++
      } catch (err) {
        console.error(`[CircleReminder] Error for event ${event.id} → ${member.phone}:`, err)
        results.errors++
      }
    }
  }

  console.log(`[CircleReminder] Done: ${results.sent} queued, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

// ── Post-Event Follow-Up (thank-you prompts) ──

export async function runPostEventFollowUp() {
  const now = new Date()
  const results = { thankYouPrompts: 0, reminders: 0 }

  // Events that ended 1-2 days ago → send thank-you prompt
  const recentlyEnded = await prisma.event.findMany({
    where: {
      date: {
        gte: new Date(now.getTime() - 2 * 86400000),
        lt: new Date(now.getTime() - 1 * 86400000),
      },
    },
    include: {
      user: { select: { id: true, phone: true, email: true, name: true, timezone: true, funnelStage: true } },
      _count: { select: { contributions: true } },
    },
  })

  for (const event of recentlyEnded) {
    if (!event.user.phone || event._count.contributions === 0) continue
    const state = parseFunnelStage(event.user.funnelStage)
    const postEventMap = state.postEventSent || {}
    if (postEventMap[event.id]) continue

    const displayName = event.user.name || 'there'
    const text = `Hope ${event.name} was amazing! ${event._count.contributions} people contributed. Send them a thank-you at giftist.ai`
    await queueMessage({
      userId: event.user.id,
      phone: event.user.phone,
      email: event.user.email,
      timezone: event.user.timezone,
      subject: `${event.name} — send thank-yous!`,
      text,
      template: 'post_event_thankyou',
      vars: [event.name, String(event._count.contributions)],
      priority: 3,
      dedupKey: `post_event_thankyou_${event.id}`,
    })

    postEventMap[event.id] = 'thanked'
    state.postEventSent = postEventMap
    await updateFunnelStage(event.user.id, state)
    results.thankYouPrompts++
  }

  // Events that ended 3-4 days ago → reminder if no thank-yous sent
  const olderEnded = await prisma.event.findMany({
    where: {
      date: {
        gte: new Date(now.getTime() - 4 * 86400000),
        lt: new Date(now.getTime() - 3 * 86400000),
      },
    },
    include: {
      user: { select: { id: true, phone: true, email: true, name: true, timezone: true, funnelStage: true } },
      contributions: { where: { thankYouSentAt: null }, select: { id: true } },
    },
  })

  for (const event of olderEnded) {
    if (!event.user.phone || event.contributions.length === 0) continue
    const state = parseFunnelStage(event.user.funnelStage)
    const postEventMap = state.postEventSent || {}
    if (postEventMap[event.id] === 'reminded') continue

    const text = `Reminder: ${event.contributions.length} contributor(s) to ${event.name} haven't received a thank-you yet. Visit giftist.ai`
    await queueMessage({
      userId: event.user.id,
      phone: event.user.phone,
      email: event.user.email,
      timezone: event.user.timezone,
      subject: `Thank-you reminder for ${event.name}`,
      text,
      template: 'post_event_reminder',
      vars: [String(event.contributions.length), event.name],
      priority: 3,
      dedupKey: `post_event_reminder_${event.id}`,
    })

    postEventMap[event.id] = 'reminded'
    state.postEventSent = postEventMap
    await updateFunnelStage(event.user.id, state)
    results.reminders++
  }

  console.log(`[PostEvent] Done: ${results.thankYouPrompts} prompts, ${results.reminders} reminders`)
  return results
}

// ── Seasonal Holiday Reminders ──

interface Holiday {
  name: string
  month: number // 0-indexed
  day: number
  message: string // personalized nudge message
}

function getHolidays(year: number): Holiday[] {
  return [
    // January
    { name: "New Year's Day", month: 0, day: 1, message: "New Year's is coming up — I have some recommendations for gifts to kick off the year right: https://giftist.ai/c/new-year" },
    { name: 'MLK Day', month: 0, day: getNthWeekday(year, 0, 1, 3), message: "MLK Day weekend is coming up — I have some recommendations for gifts for a teacher, mentor, or community leader: https://giftist.ai/c/mlk-day" },

    // February
    { name: "Galentine's Day", month: 1, day: 13, message: "Galentine's Day is coming up — I have some recommendations for your best friend: https://giftist.ai/c/galentines" },
    { name: "Valentine's Day", month: 1, day: 14, message: "Valentine's Day is 2 weeks away — I have some recommendations for your special someone: https://giftist.ai/c/valentines" },
    { name: 'Lunar New Year', month: getLunarNewYear(year).month, day: getLunarNewYear(year).day, message: "Lunar New Year is coming up — I have some recommendations for family gifts: https://giftist.ai/c/lunar-new-year" },

    // March
    { name: "International Women's Day", month: 2, day: 8, message: "International Women's Day is coming up — I have some recommendations for the important women in your life: https://giftist.ai/c/womens-day" },
    { name: "St. Patrick's Day", month: 2, day: 17, message: "St. Patrick's Day is coming up — I have some recommendations for host gifts: https://giftist.ai/c/st-patricks" },

    // April
    { name: 'Easter', month: getEaster(year).month, day: getEaster(year).day, message: "Easter is coming up — I have some recommendations for baskets, host gifts, and family: https://giftist.ai/c/easter" },
    { name: 'Earth Day', month: 3, day: 22, message: "Earth Day is coming up — I have some recommendations for eco-friendly gifts: https://giftist.ai/c/earth-day" },
    { name: 'Admin Professionals Day', month: 3, day: getLastWeekday(year, 3, 3), message: "Admin Professionals Day is coming up — I have some recommendations for a thoughtful thank-you: https://giftist.ai/c/admin-day" },

    // May
    { name: "Mother's Day", month: 4, day: getNthWeekday(year, 4, 0, 2), message: "Mother's Day is 2 weeks away — I have some recommendations she'll actually love (not another candle): https://giftist.ai/c/mothers-day" },
    { name: 'Cinco de Mayo', month: 4, day: 5, message: "Cinco de Mayo is coming up — I have some recommendations for host gifts and celebration ideas: https://giftist.ai/c/cinco-de-mayo" },
    { name: 'Teacher Appreciation', month: 4, day: getNthWeekday(year, 4, 1, 1) + 1, message: "Teacher Appreciation Week is coming up — I have some recommendations your kid's teacher will love: https://giftist.ai/c/teacher" },

    // June
    { name: "Father's Day", month: 5, day: getNthWeekday(year, 5, 0, 3), message: "Father's Day is 2 weeks away — I have some recommendations. Tell me about him and I'll personalize: https://giftist.ai/c/fathers-day" },
    { name: 'Juneteenth', month: 5, day: 19, message: "Juneteenth is coming up — I have some recommendations for meaningful gifts and Black-owned businesses: https://giftist.ai/c/juneteenth" },
    { name: 'Graduation Season', month: 5, day: 1, message: "It's graduation season — I have some recommendations for congratulations gifts: https://giftist.ai/c/graduation" },

    // July
    { name: 'Independence Day', month: 6, day: 4, message: "4th of July is coming up — I have some recommendations for host gifts and party essentials: https://giftist.ai/c/july-4th" },

    // August
    { name: 'Back to School', month: 7, day: 15, message: "Back to school season is here — I have some recommendations for students and teachers: https://giftist.ai/c/back-to-school" },
    { name: 'Friendship Day', month: 7, day: getNthWeekday(year, 7, 0, 1), message: "Friendship Day is this weekend — I have some recommendations to surprise your bestie: https://giftist.ai/c/friendship-day" },

    // September
    { name: 'Labor Day', month: 8, day: getNthWeekday(year, 8, 1, 1), message: "Labor Day weekend is coming up — I have some recommendations to thank a hardworking person in your life: https://giftist.ai/c/labor-day" },
    { name: "Grandparents' Day", month: 8, day: getNthWeekday(year, 8, 1, 1) + 6, message: "Grandparents' Day is this Sunday — I have some recommendations they'll treasure: https://giftist.ai/c/grandparents-day" },

    // October
    { name: "Boss's Day", month: 9, day: 16, message: "Boss's Day is coming up — I have some recommendations for a tasteful gift: https://giftist.ai/c/boss-day" },
    { name: 'Sweetest Day', month: 9, day: getNthWeekday(year, 9, 6, 3), message: "Sweetest Day is this Saturday — I have some recommendations to surprise your partner: https://giftist.ai/c/sweetest-day" },
    { name: 'Halloween', month: 9, day: 31, message: "Halloween is 2 weeks away — I have some recommendations for costumes, host gifts, and trick-or-treat goodies: https://giftist.ai/c/halloween" },

    // November
    { name: 'Veterans Day', month: 10, day: 11, message: "Veterans Day is coming up — I have some recommendations for a veteran or service member: https://giftist.ai/c/veterans-day" },
    { name: 'Thanksgiving', month: 10, day: getNthWeekday(year, 10, 4, 4), message: "Thanksgiving is 2 weeks away — I have some recommendations for host gifts and friendsgiving: https://giftist.ai/c/thanksgiving" },
    { name: 'Black Friday', month: 10, day: getNthWeekday(year, 10, 4, 4) + 1, message: "Black Friday is coming — I have some recommendations for the best gift deals: https://giftist.ai/c/black-friday" },

    // December
    { name: 'Christmas', month: 11, day: 25, message: "Christmas is 2 weeks away — I have some recommendations. Tell me who you're shopping for: https://giftist.ai/c/christmas" },
    { name: "New Year's Eve", month: 11, day: 31, message: "New Year's Eve is coming up — I have some recommendations for host gifts and party ideas: https://giftist.ai/c/nye" },
    { name: 'Secret Santa Season', month: 11, day: 10, message: "Secret Santa season is here — I have some recommendations under $25. Tell me about the person: https://giftist.ai/c/secret-santa" },
  ]
}

export async function runSeasonalReminders() {
  const now = new Date()
  const year = now.getFullYear()
  const results = { sent: 0 }

  const holidays = getHolidays(year)

  // Two reminder cadences: 2 weeks out and 1 day before
  const cadences: { label: string; minDays: number; maxDays: number; urgent: boolean }[] = [
    { label: '2w', minDays: 13, maxDays: 15, urgent: false },
    { label: '1d', minDays: 0, maxDays: 1, urgent: true },
  ]

  for (const holiday of holidays) {
    const holidayDate = new Date(year, holiday.month, holiday.day)
    const daysUntil = Math.ceil((holidayDate.getTime() - now.getTime()) / 86400000)

    const cadence = cadences.find(c => daysUntil >= c.minDays && daysUntil <= c.maxDays)
    if (!cadence) continue

    const dedup = `${holiday.name}_${year}_${cadence.label}`
    const slug = getSlugForHoliday(holiday.name)
    const ctaUrl = slug ? `https://giftist.ai/c/${slug}` : 'https://giftist.ai/chat'

    // Find all active users (phone or email)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        digestOptOut: false,
        OR: [
          { phone: { not: null } },
          { email: { not: null } },
        ],
      },
      select: { id: true, phone: true, email: true, name: true, timezone: true, funnelStage: true },
    })

    for (const user of users) {
      const state = parseFunnelStage(user.funnelStage)
      const seasonalMap = state.seasonalSent || {}
      if (seasonalMap[dedup]) continue

      const displayName = user.name || 'there'

      // Different copy for 2-week vs 1-day reminders
      let text: string
      let subject: string
      if (cadence.urgent) {
        text = `Hey ${displayName}! ${holiday.name} is *tomorrow* — I have some last-minute recommendations ready for you. Tap here and I'll personalize them: ${ctaUrl}`
        subject = `${holiday.name} is tomorrow — I have recommendations`
      } else {
        text = `Hey ${displayName}! ${holiday.message}`
        subject = `${holiday.name} is coming up — need gift ideas?`
      }

      const urgencyBanner = cadence.urgent
        ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <strong style="color: #92400e;">${holiday.name} is tomorrow!</strong>
          </div>`
        : ''

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          ${urgencyBanner}
          <h2 style="margin: 0 0 16px;">Hey ${displayName}!</h2>
          <p style="color: #333; line-height: 1.6;">${cadence.urgent
            ? `${holiday.name} is tomorrow — I have some last-minute recommendations ready for you. Tell me who it's for and I'll personalize them.`
            : holiday.message.replace(/(https:\/\/giftist\.ai\/c\/\S+)/, '')}</p>
          <div style="margin: 24px 0;">
            <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${cadence.urgent ? '#dc2626' : '#7c3aed'}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              ${cadence.urgent ? 'See recommendations' : 'See recommendations'}
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            The Giftist — Your Personal Gift Concierge<br/>
            <a href="https://giftist.ai" style="color: #999;">giftist.ai</a>
          </p>
        </div>
      `

      const priority = cadence.urgent ? 10 : 5
      await queueMessage({
        userId: user.id,
        phone: user.phone,
        email: user.email,
        timezone: user.timezone,
        subject,
        text,
        template: 'seasonal_reminder',
        vars: [displayName, holiday.name],
        emailHtml,
        priority,
        dedupKey: `seasonal_${holiday.name}_${year}_${cadence.label}_${user.id}`,
        expiresAt: holidayDate, // auto-skip if delayed past the holiday
      })
      results.sent++

      seasonalMap[dedup] = true
      state.seasonalSent = seasonalMap
      await updateFunnelStage(user.id, state)
    }
  }

  console.log(`[Seasonal] Done: ${results.sent} users queued (WA+SMS+Email)`)
  return results
}

// Get the Nth occurrence of a weekday in a month
// weekday: 0=Sun, 1=Mon, ..., 6=Sat
// n: 1=first, 2=second, 3=third, 4=fourth
function getNthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1)
  let day = 1 + ((weekday - first.getDay() + 7) % 7)
  day += (n - 1) * 7
  return day
}

// Get the last occurrence of a weekday in a month
function getLastWeekday(year: number, month: number, weekday: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const lastDate = new Date(year, month, lastDay)
  const diff = (lastDate.getDay() - weekday + 7) % 7
  return lastDay - diff
}

// Easter (Gregorian) — Anonymous/Meeus algorithm
function getEaster(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1 // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

// Lunar New Year approximation (simplified — covers 2024-2030)
function getLunarNewYear(year: number): { month: number; day: number } {
  const dates: Record<number, { month: number; day: number }> = {
    2024: { month: 1, day: 10 },  // Feb 10
    2025: { month: 0, day: 29 },  // Jan 29
    2026: { month: 1, day: 17 },  // Feb 17
    2027: { month: 1, day: 6 },   // Feb 6
    2028: { month: 0, day: 26 },  // Jan 26
    2029: { month: 1, day: 13 },  // Feb 13
    2030: { month: 1, day: 3 },   // Feb 3
  }
  return dates[year] || { month: 0, day: 25 } // fallback
}

// ── Lifecycle Nudges (churned users) ──

export async function runLifecycleNudges() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const results = { churned30: 0, churned60: 0 }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      digestOptOut: false,
      OR: [
        { phone: { not: null } },
        { email: { not: null } },
      ],
    },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      timezone: true,
      funnelStage: true,
      createdAt: true,
      _count: { select: { items: { where: { source: { not: 'SEED' } } }, events: true, circleMembers: true } },
    },
  })

  for (const user of users) {
    if (!user.phone && !user.email) continue
    const state = parseFunnelStage(user.funnelStage)
    const displayName = user.name || 'there'
    const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / 86400000)

    // Find last inbound WhatsApp message (phone users only)
    let daysSinceLastMsg = daysSinceSignup
    if (user.phone) {
      const lastMessage = await prisma.whatsAppMessage.findFirst({
        where: { phone: user.phone },
        orderBy: { createdAt: 'desc' },
      })
      if (lastMessage) {
        daysSinceLastMsg = Math.floor((now.getTime() - lastMessage.createdAt.getTime()) / 86400000)
      }
    }

    try {
      // CHURNED (30 days)
      if (daysSinceLastMsg >= 30 && daysSinceLastMsg < 45) {
        const last30 = state.churned30Sent ? new Date(state.churned30Sent) : null
        const monthAgo = new Date(now.getTime() - 30 * 86400000)
        if (!last30 || last30 < monthAgo) {
          const text = `Hey ${displayName}, your Gift Concierge is still here. Here's what I can do for you:\n\n- *AI Chat* — Tell me who you're shopping for, I'll send recommendations\n- *Gift DNA* — Send a chat export, I'll decode what they want\n- *Photo upload* — Send me a photo, I'll find where to buy it\n\nhttps://giftist.ai/dna`
          await queueMessage({
            userId: user.id,
            phone: user.phone,
            email: user.email,
            timezone: user.timezone,
            subject: 'Your Gift Concierge is still here',
            text,
            template: 'churned_30_day',
            vars: [displayName],
            priority: 1,
            dedupKey: `churned_30_${user.id}_${year}_${month}`,
          })
          state.churned30Sent = now.toISOString()
          await updateFunnelStage(user.id, state)
          results.churned30++
          continue
        }
      }

      // CHURNED (60 days): Final win-back attempt
      if (daysSinceLastMsg >= 60 && daysSinceLastMsg < 75) {
        const last60 = state.churned60Sent ? new Date(state.churned60Sent) : null
        const twoMonthsAgo = new Date(now.getTime() - 60 * 86400000)
        if (!last60 || last60 < twoMonthsAgo) {
          const text = `Hi ${displayName} — Giftist here. I have gift recommendations ready for you anytime. Just text me who it's for, send a photo, or share a WhatsApp chat for a full Gift DNA analysis. I'll also message you before every holiday with personalized picks. Save my number.`
          await queueMessage({
            userId: user.id,
            phone: user.phone,
            email: user.email,
            timezone: user.timezone,
            subject: 'Need help finding a gift?',
            text,
            template: 'churned_60_day',
            vars: [displayName],
            priority: 1,
            dedupKey: `churned_60_${user.id}_${year}_${month}`,
          })
          state.churned60Sent = now.toISOString()
          await updateFunnelStage(user.id, state)
          results.churned60++
          continue
        }
      }
    } catch (err) {
      console.error(`[Lifecycle] Error for user ${user.id}:`, err)
    }
  }

  console.log(`[Lifecycle] Done: churned30=${results.churned30}, churned60=${results.churned60}`)
  return results
}

function toUserLocalDate(date: Date, timezone: string | null): string {
  try {
    const tz = timezone || 'America/New_York'
    return date.toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

async function updateFunnelStage(userId: string, state: FunnelState) {
  await prisma.user.update({
    where: { id: userId },
    data: { funnelStage: JSON.stringify(state) },
  })
}

// ── One-time SMS Re-engagement for Churned US Users ──

export async function sendSmsReengagement() {
  const results = { sent: 0, skipped: 0, errors: 0 }

  // Find US users who signed up but have 0 non-seed items (never activated)
  const users = await prisma.user.findMany({
    where: {
      phone: { not: null },
      isActive: true,
      digestOptOut: false,
    },
    select: {
      id: true,
      phone: true,
      name: true,
      funnelStage: true,
      _count: { select: { items: { where: { source: { not: 'SEED' } } } } },
    },
  })

  for (const user of users) {
    if (!user.phone) continue

    // Only US numbers (+1, 11 digits)
    if (!user.phone.startsWith('1') || user.phone.length !== 11) {
      results.skipped++
      continue
    }

    // Only target users with 0 real items (never activated)
    if (user._count.items > 0) {
      results.skipped++
      continue
    }

    // Dedup: check if we already sent this
    const state = parseFunnelStage(user.funnelStage)
    if (state.reengagementSent) {
      results.skipped++
      continue
    }

    const displayName = user.name || 'there'

    try {
      let smsBody = `Hey ${displayName}! Your Gift Concierge found some new picks for you. Tap to check them out: https://wa.me/15014438478`
      if (!smsBody.includes('STOP')) {
        smsBody += '\n\nReply STOP to opt out.'
      }
      await sendSms(user.phone, smsBody)

      state.reengagementSent = new Date().toISOString()
      await updateFunnelStage(user.id, state)
      results.sent++
      console.log(`[SMSReengagement] Sent to ${user.phone}`)

      // Pace SMS: 1 per second to avoid rate limits
      await new Promise(r => setTimeout(r, 1000))
    } catch (err) {
      console.error(`[SMSReengagement] Error for user ${user.id}:`, err)
      results.errors++
    }
  }

  console.log(`[SMSReengagement] Done: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

// ── One-time Email Re-engagement for Churned Email-Only Users ──

export async function sendEmailReengagement() {
  const results = { sent: 0, skipped: 0, errors: 0 }

  // Find users who signed up with email but have 0 non-seed items
  const users = await prisma.user.findMany({
    where: {
      email: { not: null },
      isActive: true,
      digestOptOut: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      funnelStage: true,
      _count: { select: { items: { where: { source: { not: 'SEED' } } } } },
    },
  })

  for (const user of users) {
    if (!user.email) continue

    // Only target users with 0 real items (never activated)
    if (user._count.items > 0) {
      results.skipped++
      continue
    }

    // Skip if user has a phone — they'll get the SMS re-engagement instead
    if (user.phone) {
      results.skipped++
      continue
    }

    // Dedup: check if we already sent this
    const state = parseFunnelStage(user.funnelStage)
    if (state.reengagementSent) {
      results.skipped++
      continue
    }

    const displayName = user.name || 'there'

    try {
      await sendEmail({
        to: user.email,
        subject: `${displayName === 'there' ? 'Hey' : `Hey ${displayName}`} — your Gift Concierge found some picks for you`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="margin: 0 0 16px;">Hey ${displayName}!</h2>
            <p style="color: #333; line-height: 1.6;">
              Your Gift Concierge has been finding trending gifts and curating picks just for you. Come check them out!
            </p>
            <p style="color: #333; line-height: 1.6;">
              Tell me who you're shopping for and I'll find the perfect gift — whether it's a birthday, anniversary, or just because.
            </p>
            <div style="margin: 24px 0;">
              <a href="https://giftist.ai/chat" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Chat with your Gift Concierge
              </a>
            </div>
            <p style="color: #333; line-height: 1.6; font-size: 14px;">
              Or message us on WhatsApp: <a href="https://wa.me/15014438478" style="color: #7c3aed;">+1 (501) 443-8478</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">
              The Giftist — Your Personal Gift Concierge<br/>
              <a href="https://giftist.ai" style="color: #999;">giftist.ai</a>
            </p>
          </div>
        `,
      })

      state.reengagementSent = new Date().toISOString()
      await updateFunnelStage(user.id, state)
      results.sent++
      console.log(`[EmailReengagement] Sent to ${user.email}`)

      // Pace emails: 200ms between sends
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`[EmailReengagement] Error for user ${user.id}:`, err)
      results.errors++
    }
  }

  console.log(`[EmailReengagement] Done: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}
