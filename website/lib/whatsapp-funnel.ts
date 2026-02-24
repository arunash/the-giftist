import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './db'
import { logApiCall } from './api-logger'
import { smartWhatsAppSend } from './notifications'

const anthropic = new Anthropic()

interface FunnelState {
  welcome?: boolean
  firstItem?: boolean
  day1Nudge?: boolean
  day3EventPrompt?: boolean
  day5CirclePrompt?: boolean
  weeklyDigestSent?: string // ISO date of last weekly digest
  reengagementSent?: string // ISO date of last re-engagement
  goldDailySent?: string // ISO date of last Gold daily message
  eventNudgesSent?: string[] // event IDs already nudged for countdown
}

function parseFunnelStage(raw: string | null): FunnelState {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
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
  const displayName = user.name || 'there'

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

  const text = `Nice pick! "${itemName}" is saved to your wishlist.\n\nPro tip: Create an event (like "Mom's Birthday") and I'll help you organize gifts for it. Just say something like "Create an event for Mom's birthday on March 15"\n\nYou can always view your giftlist, wallet, and activity at *giftist.ai*`
  await smartWhatsAppSend(phone, text, 'welcome_message', [itemName]).catch(() => {})
}

// ── Cron job handlers (called from /api/cron/whatsapp-engagement) ──

export async function runDailyEngagement() {
  const now = new Date()
  const results = { nudges: 0, eventPrompts: 0, circlePrompts: 0, reengagements: 0, weeklyDigests: 0 }

  // Find all users with phone numbers who haven't opted out
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
      createdAt: true,
      _count: { select: { items: true, events: true, circleMembers: true } },
    },
  })

  for (const user of users) {
    if (!user.phone) continue
    const state = parseFunnelStage(user.funnelStage)
    const displayName = user.name || 'there'
    const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))

    try {
      // Stage 3: Day 1 nudge (24h after signup, < 3 items)
      if (!state.day1Nudge && daysSinceSignup >= 1 && user._count.items < 3) {
        state.day1Nudge = true
        const text = `Hey ${displayName}! Your Gift Concierge here. You've saved ${user._count.items} item(s) so far.\n\nBuilding a bigger wishlist helps your friends and family find the perfect gift for you. Try:\n- Sending me a link from any store\n- Telling me your interests so I can suggest trending gifts\n- Sending a screenshot of something you spotted online\n\nWhat are you eyeing lately?\n\nYou can always view your giftlist, wallet, and activity at *giftist.ai*`
        await smartWhatsAppSend(user.phone, text, 'day1_nudge', [displayName, String(user._count.items)])
        results.nudges++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Stage 4: Day 3 event prompt (no events created)
      if (!state.day3EventPrompt && daysSinceSignup >= 3 && user._count.events === 0) {
        state.day3EventPrompt = true
        const text = `Quick question — do you have any birthdays, holidays, or celebrations coming up?\n\nI can help you plan gifts and even remind your friends and family to contribute. Just tell me about an upcoming event!\n\nYou can always view your giftlist, wallet, and activity at *giftist.ai*`
        await smartWhatsAppSend(user.phone, text, 'day3_event_prompt', [displayName])
        results.eventPrompts++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Stage 5: Day 5 circle prompt (no circle members)
      if (!state.day5CirclePrompt && daysSinceSignup >= 5 && user._count.circleMembers === 0) {
        state.day5CirclePrompt = true
        const text = `Did you know you can build a Gift Circle? Add your close friends and family, and I'll help coordinate gift-giving for everyone.\n\nTry: *add circle 555-123-4567 Mom*\n\nYour circle members will be able to see your wishlist and contribute to gifts!\n\nYou can always view your giftlist, wallet, and activity at *giftist.ai*`
        await smartWhatsAppSend(user.phone, text, 'day5_circle_prompt', [displayName])
        results.circlePrompts++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Stage 6: Weekly digest (every Monday)
      if (now.getDay() === 1) {
        const lastDigest = state.weeklyDigestSent ? new Date(state.weeklyDigestSent) : null
        const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
        if (!lastDigest || lastDigest < weekAgo) {
          if (user._count.items > 0 || user._count.events > 0) {
            // Build digest content
            const upcomingEvents = await prisma.event.findMany({
              where: { userId: user.id, date: { gte: now } },
              orderBy: { date: 'asc' },
              take: 3,
            })

            let text = `Your weekly Giftist update:\n`
            if (upcomingEvents.length > 0) {
              for (const evt of upcomingEvents) {
                const daysUntil = Math.ceil((evt.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                text += `\n📅 ${evt.name} — ${daysUntil} day(s) away`
              }
            }
            text += `\n\nView your giftlist, wallet, and activity at *giftist.ai*\n\nReply with anything to keep chatting!`
            const eventSummary = upcomingEvents.length > 0
              ? upcomingEvents.map(evt => {
                  const daysUntil = Math.ceil((evt.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return `📅 ${evt.name} — ${daysUntil} day(s) away`
                }).join('\n')
              : 'No upcoming events — create one by chatting with me!'
            await smartWhatsAppSend(user.phone, text, 'weekly_digest', [displayName, eventSummary])
            state.weeklyDigestSent = now.toISOString()
            results.weeklyDigests++
            await updateFunnelStage(user.id, state)
            continue
          }
        }
      }

      // Stage 7: Event countdown nudge (3-7 days before event)
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
        await smartWhatsAppSend(user.phone, text, 'event_countdown', [displayName, evt.name, String(days)])
        nudgedIds.push(evt.id)
        state.eventNudgesSent = nudgedIds
        await updateFunnelStage(user.id, state)
      }

      // Stage 8: Re-engagement (14 days inactive)
      const lastMessage = await prisma.whatsAppMessage.findFirst({
        where: { phone: user.phone },
        orderBy: { createdAt: 'desc' },
      })
      if (lastMessage) {
        const daysSinceLastMessage = Math.floor((now.getTime() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        const lastReengagement = state.reengagementSent ? new Date(state.reengagementSent) : null
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

        if (daysSinceLastMessage >= 14 && (!lastReengagement || lastReengagement < twoWeeksAgo)) {
          const text = `Hey ${displayName}! Your Gift Concierge misses you.\n\nYou have ${user._count.items} item(s) on your wishlist${user._count.events > 0 ? ` and ${user._count.events} upcoming event(s)` : ''}.\n\nView your giftlist, wallet, and activity at *giftist.ai*\n\nReply anytime — I'm here to help with all things gifting!`
          const itemSummary = `${user._count.items} item(s) on your wishlist${user._count.events > 0 ? ` and ${user._count.events} upcoming event(s)` : ''}`
          await smartWhatsAppSend(user.phone, text, 'reengagement_nudge', [displayName, itemSummary])
          state.reengagementSent = now.toISOString()
          results.reengagements++
          await updateFunnelStage(user.id, state)
        }
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
      _count: { select: { items: true, events: true, circleMembers: true } },
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

        await smartWhatsAppSend(user.phone, messageText, 'gold_daily', [displayName])

        state.goldDailySent = todayStr
        await updateFunnelStage(user.id, state)
        results.sent++
        console.log(`[GoldDaily] Sent to user ${user.id}`)
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

  console.log(`[GoldDaily] Done: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`)
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
