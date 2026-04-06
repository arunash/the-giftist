import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './db'
import { logApiCall } from './api-logger'
import { smartWhatsAppSend } from './notifications'
import { sendSms } from './sms'
import { sendEmail } from './email'
import { getSlugForHoliday } from './holiday-slugs'
import { inferCountryFromPhone, COUNTRY_NAMES } from './chat-context'

const anthropic = new Anthropic()

interface FunnelState {
  welcome?: boolean
  firstItem?: boolean
  weeklyDigestSent?: string
  reengagementSent?: string
  goldDailySent?: string
  eventNudgesSent?: string[] // event IDs already nudged for countdown
  postEventSent?: Record<string, string> // eventId → 'thanked' | 'asked_feedback'
  seasonalSent?: Record<string, boolean> // 'holiday_year_cadence' → true
  churned30Sent?: string
  churned60Sent?: string
  // Product-first lifecycle stages
  onboard4h?: boolean
  onboard12h?: boolean
  onboard20h?: boolean
  day3Suggestion?: boolean
  day7Suggestion?: boolean
  day14Reactivation?: boolean
}

function parseFunnelStage(raw: string | null): FunnelState {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

// ── AI Gift Suggestion Generator ──
// Every outbound message should include a curated product suggestion.
// Uses Claude Haiku to generate contextual, specific product picks.

const SUGGESTION_SYSTEM = `You are a gift concierge. Output ONE short gift description (3-5 words max).

Rules:
- SHORT description only, e.g. "custom star map print" or "leather travel organizer"
- No brand names, no prices, no URLs
- Feel curated and thoughtful, not generic
- Never suggest: mugs, candles, generic Amazon items
- Only suggest items available in the user's country from retailers that ship there
- Output ONLY the short description, nothing else`

async function generateSuggestion(context: string, country: string = 'US'): Promise<string> {
  const countryHint = country !== 'US' ? ` User is in ${COUNTRY_NAMES[country] || country}.` : ''
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: SUGGESTION_SYSTEM,
      messages: [{ role: 'user', content: context + countryHint }],
    })
    await logApiCall({
      provider: 'ANTHROPIC',
      endpoint: 'messages',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      source: 'lifecycle-suggestion',
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return text || 'Uncommon Goods Personalized Star Map — $45'
  } catch {
    return 'Uncommon Goods Personalized Star Map — $45'
  }
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
  if (user.phone) {
    let whatsappOk = false
    try {
      await smartWhatsAppSend(user.phone, text, template, vars)
      whatsappOk = true
    } catch {}
    if (!whatsappOk) {
      const smsText = text.length > 300 ? text.slice(0, 297) + '...' : text
      await sendSms(user.phone, smsText + '\n\nReply STOP to opt out.').catch(() => {})
    }
  }
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
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  const target = new Date(userNow)
  target.setHours(17, 0, 0, 0)
  if (userNow >= target) {
    target.setDate(target.getDate() + 1)
  }
  const offset = userNow.getTime() - now.getTime()
  return new Date(target.getTime() - offset)
}

function getStartOfWeek(date: Date, timezone: string): Date {
  const tz = timezone || 'America/New_York'
  const localStr = date.toLocaleString('en-US', { timeZone: tz })
  const local = new Date(localStr)
  const dayOfWeek = local.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  local.setDate(local.getDate() + mondayOffset)
  local.setHours(0, 0, 0, 0)
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
  expiresAt?: Date,
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
    if (err?.code === 'P2002') {
      console.log(`[MessageQueue] Dedup collision: ${params.dedupKey} for ${params.template}`)
      return
    }
    throw err
  }
}

// ── Message Queue Processor ──
// Rules:
// 1. Max 2 messages per week (Mon-Sun), min 24h apart
// 2. Holiday messages (expiresAt) bypass weekly cap if expiring before next Monday
// 3. Expired messages auto-skip

export async function processMessageQueue() {
  const now = new Date()
  const results = { sent: 0, deferred: 0, expired: 0 }

  const { count: expiredCount } = await prisma.messageQueue.updateMany({
    where: { status: 'QUEUED', expiresAt: { not: null, lt: now } },
    data: { status: 'SKIPPED' },
  })
  results.expired = expiredCount

  const readyMessages = await prisma.messageQueue.findMany({
    where: { status: 'QUEUED', scheduledAt: { lte: now } },
    orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
    include: { user: { select: { timezone: true } } },
  })

  const byUser = new Map<string, typeof readyMessages>()
  for (const msg of readyMessages) {
    const list = byUser.get(msg.userId) || []
    list.push(msg)
    byUser.set(msg.userId, list)
  }

  for (const [userId, messages] of Array.from(byUser.entries())) {
    const tz = messages[0].user.timezone || 'America/New_York'

    const lastSent = await prisma.messageQueue.findFirst({
      where: { userId, status: 'SENT' },
      orderBy: { sentAt: 'desc' },
    })

    const hoursSinceLastSent = lastSent?.sentAt
      ? (now.getTime() - lastSent.sentAt.getTime()) / (1000 * 60 * 60)
      : 999

    const startOfWeek = getStartOfWeek(now, tz)
    const sentThisWeek = await prisma.messageQueue.count({
      where: { userId, status: 'SENT', sentAt: { gte: startOfWeek } },
    })

    const rateLimitOk = hoursSinceLastSent >= 24 && sentThisWeek < 2
    const urgent = messages.filter(m => m.expiresAt != null)
    const deferrable = messages.filter(m => m.expiresAt == null)

    let toSend: typeof messages[0] | null = null

    if (rateLimitOk) {
      toSend = messages[0]
    } else if (hoursSinceLastSent >= 24 && urgent.length > 0) {
      const nextMonday = getNextMonday5pm(now, tz)
      const expiringBeforeNextWeek = urgent.filter(m => m.expiresAt! < nextMonday)
      if (expiringBeforeNextWeek.length > 0) {
        expiringBeforeNextWeek.sort((a, b) => b.priority - a.priority || a.expiresAt!.getTime() - b.expiresAt!.getTime())
        toSend = expiringBeforeNextWeek[0]
      }
    }

    if (!toSend) {
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

// ── User State Classification ──

type UserState = 'NEW' | 'ACTIVE' | 'EVENT_READY' | 'HIGH_VALUE' | 'INACTIVE'

function classifyUser(user: {
  _count: { items: number; events: number; circleMembers: number }
  daysSinceLastMsg: number
}): UserState {
  if (user._count.items === 0) return 'NEW'
  if (user.daysSinceLastMsg >= 14) return 'INACTIVE'
  if (user._count.events > 0) return 'EVENT_READY'
  if (user._count.items >= 5 || user._count.circleMembers >= 2) return 'HIGH_VALUE'
  return 'ACTIVE'
}

// ── Called after each inbound WhatsApp message ──

export async function checkAndSendFunnelMessages(userId: string, phone: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      funnelStage: true,
      createdAt: true,
      _count: { select: { items: true, events: true, circleMembers: true } },
    },
  })
  if (!user) return

  const state = parseFunnelStage(user.funnelStage)

  if (!state.welcome) {
    state.welcome = true
    await updateFunnelStage(userId, state)
    return
  }

  if (!state.firstItem && user._count.items >= 1) {
    state.firstItem = true
    await updateFunnelStage(userId, state)
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
  if (state.firstItem) return

  state.firstItem = true
  await updateFunnelStage(userId, state)

  // Momentum: first save → offer more like it
  const text = `Saved! Want me to find more like "${itemName}"?`
  await smartWhatsAppSend(phone, text, 'welcome_message', [itemName]).catch(() => {})
}

// ── Daily Engagement (product-first, no feature dumps) ──

export async function runDailyEngagement() {
  const now = new Date()
  const results = { day3: 0, day7: 0, day14: 0, eventNudges: 0 }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      digestOptOut: false,
      OR: [{ phone: { not: null } }, { email: { not: null } }],
    },
    select: {
      id: true, phone: true, email: true, name: true, timezone: true,
      funnelStage: true, createdAt: true, interests: true,
      _count: { select: { items: true, events: true, circleMembers: true } },
    },
  })

  for (const user of users) {
    if (!user.phone && !user.email) continue
    const state = parseFunnelStage(user.funnelStage)
    const displayName = user.name || 'there'
    const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / 86400000)

    let daysSinceLastMessage = daysSinceSignup
    if (user.phone) {
      const lastMessage = await prisma.whatsAppMessage.findFirst({
        where: { phone: user.phone },
        orderBy: { createdAt: 'desc' },
      })
      if (lastMessage) {
        daysSinceLastMessage = Math.floor((now.getTime() - lastMessage.createdAt.getTime()) / 86400000)
      }
    }

    const userState = classifyUser({
      _count: user._count,
      daysSinceLastMsg: daysSinceLastMessage,
    })
    const userCountry = inferCountryFromPhone(user.phone)

    try {
      // Day 3: Different angle suggestion (only if still NEW or no recent engagement)
      if (!state.day3Suggestion && daysSinceSignup >= 3 && daysSinceSignup < 10) {
        if (userState === 'NEW' || daysSinceLastMessage >= 2) {
          state.day3Suggestion = true

          // Generate a contextual suggestion based on what we know
          const context = user.interests
            ? `A thoughtful gift for someone who likes: ${user.interests}.`
            : `A practical but thoughtful gift that works for almost anyone.`
          const suggestion = await generateSuggestion(context, userCountry)

          const text = `Hey ${displayName} — Giftist has trending items like ${suggestion}. Here whenever you need gift ideas!`
          await queueMessage({
            userId: user.id, phone: user.phone, email: user.email, timezone: user.timezone,
            subject: 'Found something for you',
            text,
            template: 'day3_suggestion', vars: [displayName],
            priority: 3,
            dedupKey: `day3_suggestion_${user.id}`,
          })
          results.day3++
          await updateFunnelStage(user.id, state)
          continue
        } else {
          state.day3Suggestion = true
          await updateFunnelStage(user.id, state)
        }
      }

      // Day 7: Another angle — momentum builder (only if user hasn't engaged recently)
      if (!state.day7Suggestion && daysSinceSignup >= 7 && daysSinceSignup < 14) {
        if (userState === 'NEW' || (userState === 'ACTIVE' && daysSinceLastMessage >= 5)) {
          state.day7Suggestion = true

          const context = user._count.items > 0
            ? `Something different from what they already have. A unique or experiential gift.`
            : `A crowd-favorite gift. Something that always impresses.`
          const suggestion = await generateSuggestion(context, userCountry)

          const text = `Hey ${displayName} — Giftist has new picks like ${suggestion}. Here whenever you need ideas!`
          await queueMessage({
            userId: user.id, phone: user.phone, email: user.email, timezone: user.timezone,
            subject: 'This caught my eye',
            text,
            template: 'day7_suggestion', vars: [displayName],
            priority: 3,
            dedupKey: `day7_suggestion_${user.id}`,
          })
          results.day7++
          await updateFunnelStage(user.id, state)
          continue
        } else {
          state.day7Suggestion = true
          await updateFunnelStage(user.id, state)
        }
      }

      // Day 14: Reactivation — only if truly inactive, product-first
      if (!state.day14Reactivation && daysSinceLastMessage >= 14 && daysSinceLastMessage < 30) {
        state.day14Reactivation = true

        const context = `A surprising, thoughtful gift. Something people wouldn't find on their own.`
        const suggestion = await generateSuggestion(context, userCountry)

        const text = `Hey ${displayName} — Giftist has trending items like ${suggestion}. Here whenever you need gift ideas!`
        await queueMessage({
          userId: user.id, phone: user.phone, email: user.email, timezone: user.timezone,
          subject: 'Found something you might love',
          text,
          template: 'day14_reactivation', vars: [displayName],
          priority: 2,
          dedupKey: `day14_reactivation_${user.id}`,
        })
        results.day14++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Event countdown nudges — expanded cadences: 21-30d, 14d, 7d, 3d, 1d
      const upcomingEvents = await prisma.event.findMany({
        where: {
          userId: user.id,
          date: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) },
        },
        include: {
          _count: { select: { items: true } },
          items: {
            include: { item: { select: { name: true, price: true } } },
            orderBy: { priority: 'asc' },
            take: 3,
          },
        },
      })

      const nudgedIds = state.eventNudgesSent || []
      for (const evt of upcomingEvents) {
        const days = Math.ceil((evt.date.getTime() - now.getTime()) / 86400000)

        // Determine cadence label
        let cadenceLabel: string | null = null
        if (days >= 21 && days <= 30) cadenceLabel = '30d'
        else if (days >= 13 && days <= 15) cadenceLabel = '14d'
        else if (days >= 6 && days <= 8) cadenceLabel = '7d'
        else if (days >= 2 && days <= 4) cadenceLabel = '3d'
        else if (days >= 0 && days <= 1) cadenceLabel = '1d'

        if (!cadenceLabel) continue

        const dedupId = `${evt.id}_${cadenceLabel}`
        if (nudgedIds.includes(dedupId)) continue

        let text: string
        const itemNames = evt.items.map(ei => {
          const price = ei.item.price ? ` — ${ei.item.price}` : ''
          return `${ei.item.name}${price}`
        })

        if (days >= 21) {
          text = `Hey ${displayName} — ${evt.name} is ${days} days away. Gifting anyone? Giftist has trending items ready for you.`
        } else if (days >= 13) {
          if (evt._count.items > 0) {
            text = `${evt.name} is 2 weeks away. You've got ${evt._count.items} item(s) saved. Giftist has more trending picks if you need them.`
          } else {
            text = `Hey ${displayName} — ${evt.name} is 2 weeks out. Gifting anyone? Giftist has trending items ready for you.`
          }
        } else if (days >= 6) {
          if (evt._count.items > 0) {
            text = `${evt.name} is next week — you've got ${evt._count.items} item(s) ready. 👍`
          } else {
            text = `${evt.name} is next week. Gifting anyone? Giftist has trending items ready for you.`
          }
        } else if (days >= 2) {
          if (evt._count.items > 0) {
            text = `${evt.name} is in ${days} days — you're all set with ${evt._count.items} item(s). 👍`
          } else {
            text = `${evt.name} is in ${days} days. Need gift ideas? Giftist has trending items ready for you.`
          }
        } else {
          if (evt._count.items === 0) {
            text = `${evt.name} is tomorrow! Need last-minute gift ideas? Giftist can help.`
          } else {
            text = `${evt.name} is tomorrow — you're all set. Have a great one, ${displayName}!`
          }
        }

        await queueMessage({
          userId: user.id, phone: user.phone, email: user.email, timezone: user.timezone,
          subject: `${evt.name} is ${days} days away`,
          text,
          template: 'event_countdown', vars: [displayName, evt.name, String(days)],
          priority: days <= 3 ? 8 : 5,
          dedupKey: `event_countdown_${dedupId}_${user.id}`,
          expiresAt: evt.date,
        })
        nudgedIds.push(dedupId)
        state.eventNudgesSent = nudgedIds
        await updateFunnelStage(user.id, state)
        results.eventNudges++
      }
    } catch (err) {
      console.error(`[Funnel] Error processing user ${user.id}:`, err)
    }
  }

  return results
}

// ── Gold Daily AI-Personalized Messages ──

const GOLD_DAILY_SYSTEM = `You are a gift concierge sending a short daily message. Max 100 characters.

Rules:
- Mention ONE gift idea (3-5 words, no brands or prices)
- Keep it casual and brief — like a friend's text
- Reference their upcoming events by name when available
- End with something soft like "here if you need ideas" — NOT "want me to save it?"
- Never pushy, never salesy, no questions, no bullet points
- Only suggest items from retailers that ship to the user's country
- Example: "Hey — Giftist has picks like artisan chocolate sets. Here if you need ideas!"`

export async function runGoldDailyEngagement() {
  const now = new Date()
  const results = { sent: 0, skipped: 0, errors: 0 }

  const goldUsers = await prisma.user.findMany({
    where: {
      phone: { not: null },
      isActive: true,
      digestOptOut: false,
      subscription: { status: 'ACTIVE', currentPeriodEnd: { gt: now } },
    },
    select: {
      id: true, phone: true, name: true, interests: true, timezone: true, funnelStage: true,
      _count: { select: { items: true, events: true, circleMembers: true } },
    },
  })

  for (let i = 0; i < goldUsers.length; i += 5) {
    const batch = goldUsers.slice(i, i + 5)

    await Promise.all(batch.map(async (user) => {
      if (!user.phone) { results.skipped++; return }

      const state = parseFunnelStage(user.funnelStage)
      const todayStr = toUserLocalDate(now, user.timezone)

      if (state.goldDailySent === todayStr) {
        results.skipped++
        return
      }

      try {
        const upcomingEvents = await prisma.event.findMany({
          where: { userId: user.id, date: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
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

        const goldCountry = inferCountryFromPhone(user.phone)
        const contextMsg = [
          `Name: ${displayName}`,
          `Country: ${COUNTRY_NAMES[goldCountry] || goldCountry}`,
          `Upcoming events (next 30d): ${eventCtx}`,
          `Recent wishlist items: ${itemCtx}`,
          `Total items: ${user._count.items}, events: ${user._count.events}, circle: ${user._count.circleMembers}`,
          user.interests ? `Interests: ${user.interests}` : null,
          wallet?.balance ? `Wallet: $${wallet.balance.toFixed(2)}` : null,
        ].filter(Boolean).join('\n')

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: GOLD_DAILY_SYSTEM,
          messages: [{ role: 'user', content: contextMsg }],
        })

        const messageText = response.content[0].type === 'text' ? response.content[0].text : ''
        if (!messageText) { results.errors++; return }

        await logApiCall({
          provider: 'ANTHROPIC', endpoint: 'messages', model: 'claude-haiku-4-5-20251001',
          inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
          userId: user.id, source: 'gold-daily-engagement',
        })

        await queueMessage({
          userId: user.id, phone: user.phone, email: null, timezone: user.timezone,
          subject: 'Your daily gift update',
          text: messageText,
          template: 'gold_daily', vars: [displayName],
          priority: 5,
          dedupKey: `gold_daily_${user.id}_${todayStr}`,
        })

        state.goldDailySent = todayStr
        await updateFunnelStage(user.id, state)
        results.sent++
      } catch (err) {
        console.error(`[GoldDaily] Error for user ${user.id}:`, err)
        results.errors++
      }
    }))

    if (i + 5 < goldUsers.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log(`[GoldDaily] Done: ${results.sent} queued, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

// ── Circle Member Event Reminders ──

export async function runCircleEventReminders() {
  const now = new Date()
  const results = { sent: 0, skipped: 0, errors: 0 }

  const cadences = [
    { label: '14d', minDays: 13, maxDays: 15 },
    { label: '7d',  minDays: 6,  maxDays: 8 },
    { label: '3d',  minDays: 2,  maxDays: 4 },
    { label: '1d',  minDays: 0,  maxDays: 1 },
  ]

  const events = await prisma.event.findMany({
    where: { date: { gte: now, lte: new Date(now.getTime() + 16 * 86400000) } },
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
    if (!event.user.isActive || event.user.digestOptOut) continue
    if (event.user.circleMembers.length === 0) continue

    const daysUntil = Math.ceil((event.date.getTime() - now.getTime()) / 86400000)
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
      const alreadySent = event.circleReminders.some(
        r => r.phone === member.phone && r.cadence === cadence.label
      )
      if (alreadySent) { results.skipped++; continue }

      const memberName = member.name || 'Hey there'

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
        await queueMessage({
          userId: event.userId, phone: member.phone, email: null, timezone: event.user.timezone,
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

// ── Post-Event Follow-Up ──

export async function runPostEventFollowUp() {
  const now = new Date()
  const results = { thankYouPrompts: 0, feedbackAsks: 0 }

  // 1-2 days after: "Want to send a thank you?"
  const recentlyEnded = await prisma.event.findMany({
    where: {
      date: { gte: new Date(now.getTime() - 2 * 86400000), lt: new Date(now.getTime() - 1 * 86400000) },
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

    const text = `Hope ${event.name} went well! ${event._count.contributions} people contributed. 🎉`
    await queueMessage({
      userId: event.user.id, phone: event.user.phone, email: event.user.email, timezone: event.user.timezone,
      subject: `${event.name} — send thank-yous!`,
      text,
      template: 'post_event_thankyou', vars: [event.name, String(event._count.contributions)],
      priority: 3,
      dedupKey: `post_event_thankyou_${event.id}`,
    })

    postEventMap[event.id] = 'thanked'
    state.postEventSent = postEventMap
    await updateFunnelStage(event.user.id, state)
    results.thankYouPrompts++
  }

  // 3-5 days after: "How did the gift land?"
  const olderEnded = await prisma.event.findMany({
    where: {
      date: { gte: new Date(now.getTime() - 5 * 86400000), lt: new Date(now.getTime() - 3 * 86400000) },
    },
    include: {
      user: { select: { id: true, phone: true, email: true, name: true, timezone: true, funnelStage: true } },
      _count: { select: { items: true } },
    },
  })

  for (const event of olderEnded) {
    if (!event.user.phone) continue
    const state = parseFunnelStage(event.user.funnelStage)
    const postEventMap = state.postEventSent || {}
    if (postEventMap[event.id] === 'asked_feedback') continue

    const text = `How did ${event.name} go? Here whenever you need gift ideas for next time!`
    await queueMessage({
      userId: event.user.id, phone: event.user.phone, email: event.user.email, timezone: event.user.timezone,
      subject: `How did ${event.name} go?`,
      text,
      template: 'post_event_feedback', vars: [event.name],
      priority: 2,
      dedupKey: `post_event_feedback_${event.id}`,
    })

    postEventMap[event.id] = 'asked_feedback'
    state.postEventSent = postEventMap
    await updateFunnelStage(event.user.id, state)
    results.feedbackAsks++
  }

  console.log(`[PostEvent] Done: ${results.thankYouPrompts} prompts, ${results.feedbackAsks} feedback asks`)
  return results
}

// ── Seasonal Holiday Reminders ──
// DO NOT blast all users. Filter by: relevance, engagement level, recent activity.

interface Holiday {
  name: string
  month: number
  day: number
  message: string
}

function getHolidays(year: number): Holiday[] {
  return [
    // January
    { name: "New Year's Day", month: 0, day: 1, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: 'MLK Day', month: 0, day: getNthWeekday(year, 0, 1, 3), message: "gifting anyone? Giftist has trending items ready for you." },
    // February
    { name: "Galentine's Day", month: 1, day: 13, message: "gifting your friends? Giftist has trending items ready for you." },
    { name: "Valentine's Day", month: 1, day: 14, message: "gifting someone special? Giftist has trending items ready for you." },
    { name: 'Lunar New Year', month: getLunarNewYear(year).month, day: getLunarNewYear(year).day, message: "gifting anyone? Giftist has trending items ready for you." },
    // March
    { name: "International Women's Day", month: 2, day: 8, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: "St. Patrick's Day", month: 2, day: 17, message: "gifting anyone? Giftist has trending items ready for you." },
    // April
    { name: 'Easter', month: getEaster(year).month, day: getEaster(year).day, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: 'Earth Day', month: 3, day: 22, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: 'Admin Professionals Day', month: 3, day: getLastWeekday(year, 3, 3), message: "gifting anyone? Giftist has trending items ready for you." },
    // May
    { name: "Mother's Day", month: 4, day: getNthWeekday(year, 4, 0, 2), message: "gifting mom? Giftist has trending items ready for you." },
    { name: 'Cinco de Mayo', month: 4, day: 5, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: 'Teacher Appreciation', month: 4, day: getNthWeekday(year, 4, 1, 1) + 1, message: "gifting a teacher? Giftist has trending items ready for you." },
    // June
    { name: "Father's Day", month: 5, day: getNthWeekday(year, 5, 0, 3), message: "gifting dad? Giftist has trending items ready for you." },
    { name: 'Juneteenth', month: 5, day: 19, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: 'Graduation Season', month: 5, day: 1, message: "gifting a grad? Giftist has trending items ready for you." },
    // July
    { name: 'Independence Day', month: 6, day: 4, message: "gifting anyone? Giftist has trending items ready for you." },
    // August
    { name: 'Back to School', month: 7, day: 15, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: 'Friendship Day', month: 7, day: getNthWeekday(year, 7, 0, 1), message: "gifting a friend? Giftist has trending items ready for you." },
    // September
    { name: 'Labor Day', month: 8, day: getNthWeekday(year, 8, 1, 1), message: "gifting anyone? Giftist has trending items ready for you." },
    { name: "Grandparents' Day", month: 8, day: getNthWeekday(year, 8, 1, 1) + 6, message: "gifting your grandparents? Giftist has trending items ready for you." },
    // October
    { name: "Boss's Day", month: 9, day: 16, message: "gifting your boss? Giftist has trending items ready for you." },
    { name: 'Sweetest Day', month: 9, day: getNthWeekday(year, 9, 6, 3), message: "gifting someone special? Giftist has trending items ready for you." },
    { name: 'Halloween', month: 9, day: 31, message: "gifting anyone? Giftist has trending items ready for you." },
    // November
    { name: 'Veterans Day', month: 10, day: 11, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: 'Thanksgiving', month: 10, day: getNthWeekday(year, 10, 4, 4), message: "gifting the host? Giftist has trending items ready for you." },
    { name: 'Black Friday', month: 10, day: getNthWeekday(year, 10, 4, 4) + 1, message: "gifting anyone? Giftist has great deals ready for you." },
    // December
    { name: 'Secret Santa Season', month: 11, day: 10, message: "need Secret Santa ideas? Giftist has trending items ready for you." },
    { name: 'Christmas', month: 11, day: 25, message: "gifting anyone? Giftist has trending items ready for you." },
    { name: "New Year's Eve", month: 11, day: 31, message: "gifting anyone? Giftist has trending items ready for you." },
  ]
}

export async function runSeasonalReminders() {
  const now = new Date()
  const year = now.getFullYear()
  const results = { sent: 0, filtered: 0 }

  const holidays = getHolidays(year)

  // Three cadences: 14 days (discovery), 7 days (shortlist), 1 day (urgency)
  const cadences: { label: string; minDays: number; maxDays: number; urgent: boolean }[] = [
    { label: '14d', minDays: 13, maxDays: 15, urgent: false },
    { label: '7d', minDays: 6, maxDays: 8, urgent: false },
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

    // Filter: only send to users with recent activity (last 60 days) or who have events/items
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        digestOptOut: false,
        OR: [{ phone: { not: null } }, { email: { not: null } }],
      },
      select: {
        id: true, phone: true, email: true, name: true, timezone: true, funnelStage: true,
        createdAt: true,
        _count: { select: { items: true, events: true, circleMembers: true } },
      },
    })

    for (const user of users) {
      const state = parseFunnelStage(user.funnelStage)
      const seasonalMap = state.seasonalSent || {}
      if (seasonalMap[dedup]) continue

      // RELEVANCE FILTER: Skip if user has no engagement signals
      const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / 86400000)
      let daysSinceLastMsg = daysSinceSignup
      if (user.phone) {
        const lastMsg = await prisma.whatsAppMessage.findFirst({
          where: { phone: user.phone },
          orderBy: { createdAt: 'desc' },
        })
        if (lastMsg) {
          daysSinceLastMsg = Math.floor((now.getTime() - lastMsg.createdAt.getTime()) / 86400000)
        }
      }

      // Don't blast inactive users — only send if:
      // 1. User has engaged in last 60 days, OR
      // 2. User has saved items or events (shows investment), OR
      // 3. It's a major holiday (Christmas, Mother's Day, Father's Day, Valentine's) AND user signed up < 90 days ago
      const majorHolidays = ["Christmas", "Mother's Day", "Father's Day", "Valentine's Day", "Thanksgiving"]
      const isMajor = majorHolidays.includes(holiday.name)
      const hasEngagement = daysSinceLastMsg < 60
      const hasInvestment = user._count.items > 0 || user._count.events > 0
      const isRecent = daysSinceSignup < 90

      if (!hasEngagement && !hasInvestment && !(isMajor && isRecent)) {
        results.filtered++
        continue
      }

      // If user already engaged with this holiday at a previous cadence, skip non-urgent
      if (!cadence.urgent) {
        const earlierCadences = cadences.filter(c => c.label !== cadence.label && !c.urgent)
        const alreadyEngaged = earlierCadences.some(c => seasonalMap[`${holiday.name}_${year}_${c.label}`])
        // Check if user responded after earlier cadence (they're engaged, don't re-send)
        // For now, just skip if they were already sent a prior cadence
        if (alreadyEngaged) {
          results.filtered++
          continue
        }
      }

      const displayName = user.name || 'there'

      // Personalize: check if user has circle members who might be relevant
      let text: string
      let subject: string

      if (cadence.label === '14d') {
        text = `Hey ${displayName} — ${holiday.name} is coming up. ${holiday.message}`
        subject = `${holiday.name} is coming up`
      } else if (cadence.label === '7d') {
        text = `${displayName} — ${holiday.name} is next week. ${holiday.message}`
        subject = `${holiday.name} is next week`
      } else {
        text = `${displayName} — ${holiday.name} is tomorrow! ${holiday.message}`
        subject = `${holiday.name} is tomorrow`
      }

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 16px;">Hey ${displayName}!</h2>
          <p style="color: #333; line-height: 1.6;">${text}</p>
          <div style="margin: 24px 0;">
            <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${cadence.urgent ? '#dc2626' : '#7c3aed'}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              ${cadence.urgent ? 'Find a gift now' : 'See recommendation'}
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">The Giftist — <a href="https://giftist.ai" style="color: #999;">giftist.ai</a></p>
        </div>
      `

      const priority = cadence.urgent ? 10 : cadence.label === '7d' ? 7 : 5
      await queueMessage({
        userId: user.id, phone: user.phone, email: user.email, timezone: user.timezone,
        subject, text,
        template: 'seasonal_reminder', vars: [displayName, holiday.name],
        emailHtml, priority,
        dedupKey: `seasonal_${holiday.name}_${year}_${cadence.label}_${user.id}`,
        expiresAt: holidayDate,
      })
      results.sent++

      seasonalMap[dedup] = true
      state.seasonalSent = seasonalMap
      await updateFunnelStage(user.id, state)
    }
  }

  console.log(`[Seasonal] Done: ${results.sent} queued, ${results.filtered} filtered out`)
  return results
}

// ── Lifecycle Nudges (churned users — product-first, no feature dumps) ──

export async function runLifecycleNudges() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const results = { churned30: 0, churned60: 0 }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      digestOptOut: false,
      OR: [{ phone: { not: null } }, { email: { not: null } }],
    },
    select: {
      id: true, phone: true, email: true, name: true, timezone: true,
      funnelStage: true, createdAt: true, interests: true,
      _count: { select: { items: true, events: true } },
    },
  })

  for (const user of users) {
    if (!user.phone && !user.email) continue
    const state = parseFunnelStage(user.funnelStage)
    const displayName = user.name || 'there'
    const userCountry = inferCountryFromPhone(user.phone)
    const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / 86400000)

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
      // 30-day churn: Product-first re-engagement (not feature list)
      if (daysSinceLastMsg >= 30 && daysSinceLastMsg < 45) {
        const last30 = state.churned30Sent ? new Date(state.churned30Sent) : null
        const monthAgo = new Date(now.getTime() - 30 * 86400000)
        if (!last30 || last30 < monthAgo) {
          const context = user.interests
            ? `A surprising, thoughtful gift for someone who likes: ${user.interests}.`
            : `A surprising gift people wouldn't think of on their own.`
          const suggestion = await generateSuggestion(context, userCountry)

          const text = `Hey ${displayName} — Giftist has trending items like ${suggestion}. Check them out anytime!`
          await queueMessage({
            userId: user.id, phone: user.phone, email: user.email, timezone: user.timezone,
            subject: 'Found something you might like',
            text,
            template: 'churned_30_day', vars: [displayName],
            priority: 1,
            dedupKey: `churned_30_${user.id}_${year}_${month}`,
          })
          state.churned30Sent = now.toISOString()
          await updateFunnelStage(user.id, state)
          results.churned30++
          continue
        }
      }

      // 60-day churn: Final attempt — still product-first
      if (daysSinceLastMsg >= 60 && daysSinceLastMsg < 75) {
        const last60 = state.churned60Sent ? new Date(state.churned60Sent) : null
        const twoMonthsAgo = new Date(now.getTime() - 60 * 86400000)
        if (!last60 || last60 < twoMonthsAgo) {
          const suggestion = await generateSuggestion(`A crowd-favorite gift that always impresses. Something fresh and interesting.`, userCountry)

          const text = `Hey ${displayName} — Giftist has new trending items like ${suggestion}. Here if you need gift ideas!`
          await queueMessage({
            userId: user.id, phone: user.phone, email: user.email, timezone: user.timezone,
            subject: 'This is trending right now',
            text,
            template: 'churned_60_day', vars: [displayName],
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

// ── Date Helpers ──

function getNthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1)
  let day = 1 + ((weekday - first.getDay() + 7) % 7)
  day += (n - 1) * 7
  return day
}

function getLastWeekday(year: number, month: number, weekday: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const lastDate = new Date(year, month, lastDay)
  const diff = (lastDate.getDay() - weekday + 7) % 7
  return lastDay - diff
}

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
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function getLunarNewYear(year: number): { month: number; day: number } {
  const dates: Record<number, { month: number; day: number }> = {
    2024: { month: 1, day: 10 },
    2025: { month: 0, day: 29 },
    2026: { month: 1, day: 17 },
    2027: { month: 1, day: 6 },
    2028: { month: 0, day: 26 },
    2029: { month: 1, day: 13 },
    2030: { month: 1, day: 3 },
  }
  return dates[year] || { month: 0, day: 25 }
}

function toUserLocalDate(date: Date, timezone: string | null): string {
  try {
    return date.toLocaleDateString('en-CA', { timeZone: timezone || 'America/New_York' })
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

// ── SMS Re-engagement (product-first) ──

export async function sendSmsReengagement() {
  const results = { sent: 0, skipped: 0, errors: 0 }

  const users = await prisma.user.findMany({
    where: { phone: { not: null }, isActive: true, digestOptOut: false },
    select: {
      id: true, phone: true, name: true, funnelStage: true,
      _count: { select: { items: true } },
    },
  })

  for (const user of users) {
    if (!user.phone) continue
    if (!user.phone.startsWith('1') || user.phone.length !== 11) { results.skipped++; continue }
    if (user._count.items > 0) { results.skipped++; continue }

    const state = parseFunnelStage(user.funnelStage)
    if (state.reengagementSent) { results.skipped++; continue }

    const displayName = user.name || 'there'

    try {
      const smsBody = `Hey ${displayName} — I have a gift idea for you. Tell me who it's for: https://wa.me/15014438478\n\nReply STOP to opt out.`
      await sendSms(user.phone, smsBody)

      state.reengagementSent = new Date().toISOString()
      await updateFunnelStage(user.id, state)
      results.sent++

      await new Promise(r => setTimeout(r, 1000))
    } catch (err) {
      console.error(`[SMSReengagement] Error for user ${user.id}:`, err)
      results.errors++
    }
  }

  console.log(`[SMSReengagement] Done: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}

// ── Email Re-engagement (product-first) ──

export async function sendEmailReengagement() {
  const results = { sent: 0, skipped: 0, errors: 0 }

  const users = await prisma.user.findMany({
    where: { email: { not: null }, isActive: true, digestOptOut: false },
    select: {
      id: true, email: true, name: true, phone: true, funnelStage: true,
      _count: { select: { items: true } },
    },
  })

  for (const user of users) {
    if (!user.email) continue
    if (user._count.items > 0) { results.skipped++; continue }
    if (user.phone) { results.skipped++; continue }

    const state = parseFunnelStage(user.funnelStage)
    if (state.reengagementSent) { results.skipped++; continue }

    const displayName = user.name || 'there'

    try {
      const suggestion = await generateSuggestion(`Suggest one impressive, universally loved gift under $60.`, inferCountryFromPhone(user.phone))

      await sendEmail({
        to: user.email,
        subject: `${displayName === 'there' ? 'Hey' : `Hey ${displayName}`} — found something you might like`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="margin: 0 0 16px;">Hey ${displayName}!</h2>
            <p style="color: #333; line-height: 1.6;">
              I found something I think you'd like:
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="color: #111; font-weight: 600; margin: 0;">${suggestion}</p>
            </div>
            <p style="color: #333; line-height: 1.6;">
              Tell me who you're shopping for and I'll personalize it.
            </p>
            <div style="margin: 24px 0;">
              <a href="https://giftist.ai/chat" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Chat with your Gift Concierge
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">The Giftist — <a href="https://giftist.ai" style="color: #999;">giftist.ai</a></p>
          </div>
        `,
      })

      state.reengagementSent = new Date().toISOString()
      await updateFunnelStage(user.id, state)
      results.sent++

      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`[EmailReengagement] Error for user ${user.id}:`, err)
      results.errors++
    }
  }

  console.log(`[EmailReengagement] Done: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`)
  return results
}
