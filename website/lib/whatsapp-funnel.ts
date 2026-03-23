import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './db'
import { logApiCall } from './api-logger'
import { smartWhatsAppSend } from './notifications'
import { sendSms } from './sms'
import { sendEmail } from './email'

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
      _count: { select: { items: { where: { source: { not: 'SEED' } } }, events: true, circleMembers: true } },
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

  // Stage 2b: Third real item saved — nudge to link items to events
  if (!state.thirdItemEventNudge && user._count.items >= 3) {
    state.thirdItemEventNudge = true
    await updateFunnelStage(userId, state)
    const text = `You've saved ${user._count.items} items — nice taste! Want to link them to an event?\n\nType *events* to see your upcoming events, or tell me about a birthday or celebration!`
    await smartWhatsAppSend(phone, text, 'third_item_event_nudge', [displayName, String(user._count.items)]).catch(() => {})
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

  const text = `Nice pick! "${itemName}" is saved to your wishlist.\n\nWant to link this to one of your events? I've set up Christmas, Mother's Day, Father's Day, and more. Type *events* to see what's coming up!\n\nPro tip: Add friends to your Gift Circle and they'll see your wishlist. Try: *add circle 555-123-4567 Mom*`
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
      _count: { select: { items: { where: { source: { not: 'SEED' } } }, events: true, circleMembers: true } },
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

      // Stage 5: Day 2 circle prompt (no circle members — moved up from day 5)
      if (!state.day5CirclePrompt && daysSinceSignup >= 2 && user._count.circleMembers === 0) {
        state.day5CirclePrompt = true
        const text = `Quick reminder — adding people to your Gift Circle means they'll get notified about your events and see your wishlist. Just send me their phone number and name!\n\nTry: *add circle 555-123-4567 Mom*\n\nYou can always view your giftlist, wallet, and activity at *giftist.ai*`
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
          name: true, shareId: true, isActive: true, digestOptOut: true,
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
        await smartWhatsAppSend(
          member.phone, text,
          'circle_event_reminder',
          [memberName, ownerName, event.name, String(daysUntil), shareUrl]
        )

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

  console.log(`[CircleReminder] Done: ${results.sent} sent, ${results.skipped} skipped, ${results.errors} errors`)
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
      user: { select: { id: true, phone: true, name: true, funnelStage: true } },
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
    await smartWhatsAppSend(event.user.phone, text, 'post_event_thankyou', [event.name, String(event._count.contributions)]).catch(() => {})

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
      user: { select: { id: true, phone: true, name: true, funnelStage: true } },
      contributions: { where: { thankYouSentAt: null }, select: { id: true } },
    },
  })

  for (const event of olderEnded) {
    if (!event.user.phone || event.contributions.length === 0) continue
    const state = parseFunnelStage(event.user.funnelStage)
    const postEventMap = state.postEventSent || {}
    if (postEventMap[event.id] === 'reminded') continue

    const text = `Reminder: ${event.contributions.length} contributor(s) to ${event.name} haven't received a thank-you yet. Visit giftist.ai`
    await smartWhatsAppSend(event.user.phone, text, 'post_event_reminder', [String(event.contributions.length), event.name]).catch(() => {})

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
    { name: "New Year's Day", month: 0, day: 1, message: "New Year's is here! Start the year right — create a wishlist for yourself or find a gift for someone who made last year special." },
    { name: 'MLK Day', month: 0, day: getNthWeekday(year, 0, 1, 3), message: "MLK Day weekend is coming up. A great time to give back — need gift ideas for a teacher, mentor, or community leader?" },

    // February
    { name: "Galentine's Day", month: 1, day: 13, message: "Galentine's Day is tomorrow! Need a last-minute gift for your best friend? I've got ideas." },
    { name: "Valentine's Day", month: 1, day: 14, message: "Valentine's Day is 2 weeks away! Want to set up a wishlist for your partner or find the perfect gift?" },
    { name: 'Lunar New Year', month: getLunarNewYear(year).month, day: getLunarNewYear(year).day, message: "Lunar New Year is coming! Need gift ideas? Red envelopes, treats, or something special for family?" },

    // March
    { name: "International Women's Day", month: 2, day: 8, message: "International Women's Day is coming up. Want to find a thoughtful gift for an important woman in your life?" },
    { name: "St. Patrick's Day", month: 2, day: 17, message: "St. Patrick's Day is around the corner. Hosting or attending a party? I can help with host gifts!" },

    // April
    { name: 'Easter', month: getEaster(year).month, day: getEaster(year).day, message: "Easter is 2 weeks away! Need basket ideas, host gifts, or something special for the kids?" },
    { name: 'Earth Day', month: 3, day: 22, message: "Earth Day is coming up. Looking for eco-friendly or sustainable gift ideas? I've got great ones." },
    { name: 'Admin Professionals Day', month: 3, day: getLastWeekday(year, 3, 3), message: "Administrative Professionals Day is coming up! Want to find a thoughtful thank-you gift for someone at work?" },

    // May
    { name: "Mother's Day", month: 4, day: getNthWeekday(year, 4, 0, 2), message: "Mother's Day is 2 weeks away! Let me help you find something she'll actually love — not another candle." },
    { name: 'Cinco de Mayo', month: 4, day: 5, message: "Cinco de Mayo is coming! Hosting or attending a party? I can help with host gifts and celebration ideas." },
    { name: 'Teacher Appreciation', month: 4, day: getNthWeekday(year, 4, 1, 1) + 1, message: "Teacher Appreciation Week is coming up! Want to find a gift your kid's teacher will actually love?" },

    // June
    { name: "Father's Day", month: 5, day: getNthWeekday(year, 5, 0, 3), message: "Father's Day is 2 weeks away! Tell me about your dad and I'll find something perfect." },
    { name: 'Juneteenth', month: 5, day: 19, message: "Juneteenth is coming up. Looking for meaningful gifts to celebrate or support Black-owned businesses? I can help." },
    { name: 'Graduation Season', month: 5, day: 1, message: "It's graduation season! Know any graduates? Let me help you find the perfect congratulations gift." },

    // July
    { name: 'Independence Day', month: 6, day: 4, message: "4th of July is coming! Hosting a cookout? I can help with host gifts and party essentials." },

    // August
    { name: 'Back to School', month: 7, day: 15, message: "Back to school season is here! Need gift ideas for students, teachers, or dorm room essentials?" },
    { name: 'Friendship Day', month: 7, day: getNthWeekday(year, 7, 0, 1), message: "Friendship Day is this weekend! Want to surprise your bestie with something thoughtful?" },

    // September
    { name: 'Labor Day', month: 8, day: getNthWeekday(year, 8, 1, 1), message: "Labor Day weekend is coming! Great time to thank a hardworking person in your life. Need gift ideas?" },
    { name: "Grandparents' Day", month: 8, day: getNthWeekday(year, 8, 1, 1) + 6, message: "Grandparents' Day is this Sunday! Want to find something special for grandma or grandpa?" },

    // October
    { name: "Boss's Day", month: 9, day: 16, message: "Boss's Day is coming up on Oct 16. Want to find a tasteful gift or organize a group gift from the team?" },
    { name: 'Sweetest Day', month: 9, day: getNthWeekday(year, 9, 6, 3), message: "Sweetest Day is this Saturday! A great excuse to surprise your partner with something sweet." },
    { name: 'Halloween', month: 9, day: 31, message: "Halloween is 2 weeks away! Need costume accessories, party host gifts, or trick-or-treat goodies?" },

    // November
    { name: 'Veterans Day', month: 10, day: 11, message: "Veterans Day is coming up. Want to find a meaningful gift for a veteran or active service member?" },
    { name: 'Thanksgiving', month: 10, day: getNthWeekday(year, 10, 4, 4), message: "Thanksgiving is 2 weeks away! Need host gifts, friendsgiving ideas, or holiday prep essentials?" },
    { name: 'Black Friday', month: 10, day: getNthWeekday(year, 10, 4, 4) + 1, message: "Black Friday is coming! Your wishlist is the perfect shopping list. Share it with family so they know what to get you." },

    // December
    { name: 'Christmas', month: 11, day: 25, message: "Christmas is 2 weeks away! Time to finalize your wishlist and share it with family. Need last-minute gift ideas?" },
    { name: "New Year's Eve", month: 11, day: 31, message: "New Year's Eve is coming! Hosting a party or attending one? I can help with host gifts and celebration ideas." },
    { name: 'Secret Santa Season', month: 11, day: 10, message: "Secret Santa season is here! Need gift ideas under $25? Tell me about the person and I'll find something great." },
  ]
}

export async function runSeasonalReminders() {
  const now = new Date()
  const year = now.getFullYear()
  const results = { sent: 0 }

  const holidays = getHolidays(year)

  for (const holiday of holidays) {
    const holidayDate = new Date(year, holiday.month, holiday.day)
    const daysUntil = Math.ceil((holidayDate.getTime() - now.getTime()) / 86400000)

    // Send 13-15 days before (2 weeks out)
    if (daysUntil < 13 || daysUntil > 15) continue

    const dedup = `${holiday.name}_${year}`

    const users = await prisma.user.findMany({
      where: {
        phone: { not: null },
        isActive: true,
        digestOptOut: false,
      },
      select: { id: true, phone: true, name: true, funnelStage: true },
    })

    for (const user of users) {
      if (!user.phone) continue
      const state = parseFunnelStage(user.funnelStage)
      const seasonalMap = state.seasonalSent || {}
      if (seasonalMap[dedup]) continue

      const displayName = user.name || 'there'
      const text = `Hey ${displayName}! ${holiday.message}`
      await smartWhatsAppSend(user.phone, text, 'seasonal_reminder', [displayName, holiday.name]).catch(() => {})

      seasonalMap[dedup] = true
      state.seasonalSent = seasonalMap
      await updateFunnelStage(user.id, state)
      results.sent++
    }
  }

  console.log(`[Seasonal] Done: ${results.sent} sent`)
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

// ── Lifecycle Nudges (returning, mature, churned) ──

export async function runLifecycleNudges() {
  const now = new Date()
  const results = { returningWelcomeBack: 0, matureFeatureDiscovery: 0, churned30: 0, churned60: 0 }

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
      _count: { select: { items: { where: { source: { not: 'SEED' } } }, events: true, circleMembers: true } },
    },
  })

  for (const user of users) {
    if (!user.phone) continue
    const state = parseFunnelStage(user.funnelStage)
    const displayName = user.name || 'there'
    const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / 86400000)

    // Find last inbound WhatsApp message
    const lastMessage = await prisma.whatsAppMessage.findFirst({
      where: { phone: user.phone },
      orderBy: { createdAt: 'desc' },
    })
    const daysSinceLastMsg = lastMessage
      ? Math.floor((now.getTime() - lastMessage.createdAt.getTime()) / 86400000)
      : daysSinceSignup

    try {
      // RETURNING: User came back after 7-13 days of inactivity (before the 14-day re-engagement fires)
      if (daysSinceLastMsg >= 7 && daysSinceLastMsg < 14) {
        const lastWB = state.returningWelcomeBack ? new Date(state.returningWelcomeBack) : null
        const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)
        if (!lastWB || lastWB < twoWeeksAgo) {
          const text = `Welcome back ${displayName}! Your wishlist has ${user._count.items} item(s).${user._count.events > 0 ? ` You have ${user._count.events} event(s) coming up.` : ''} What are you looking for today?`
          await smartWhatsAppSend(user.phone, text, 'returning_welcome_back', [displayName, String(user._count.items)])
          state.returningWelcomeBack = now.toISOString()
          await updateFunnelStage(user.id, state)
          results.returningWelcomeBack++
          continue
        }
      }

      // MATURE: Active user with 5+ items, 1+ events, signed up 14+ days ago — feature discovery
      if (daysSinceSignup >= 14 && user._count.items >= 5 && user._count.events >= 1 && daysSinceLastMsg < 7) {
        const lastFD = state.matureFeatureDiscovery ? new Date(state.matureFeatureDiscovery) : null
        const monthAgo = new Date(now.getTime() - 30 * 86400000)
        if (!lastFD || lastFD < monthAgo) {
          let tip: string
          if (user._count.circleMembers === 0) {
            tip = `Did you know you can build a Gift Circle? Add friends and family so they see your wishlist and get reminders before your events. Try: *add circle <phone> <name>*`
          } else {
            tip = `Pro tip: Reply *remind* to send your Gift Circle a reminder about upcoming events with your wishlist link. They'll love the heads-up!`
          }
          await smartWhatsAppSend(user.phone, `Hey ${displayName}! ${tip}`, 'mature_feature_discovery', [displayName])
          state.matureFeatureDiscovery = now.toISOString()
          await updateFunnelStage(user.id, state)
          results.matureFeatureDiscovery++
          continue
        }
      }

      // CHURNED (30 days): Stronger nudge than 14-day re-engagement
      if (daysSinceLastMsg >= 30 && daysSinceLastMsg < 45) {
        const last30 = state.churned30Sent ? new Date(state.churned30Sent) : null
        const monthAgo = new Date(now.getTime() - 30 * 86400000)
        if (!last30 || last30 < monthAgo) {
          const text = `Hey ${displayName}, it's been a while! We've added new features — personalized gift suggestions, group gifting, and more. Your ${user._count.items} saved item(s) are still here. What's the next occasion you're shopping for?`
          await smartWhatsAppSend(user.phone, text, 'churned_30_day', [displayName, String(user._count.items)])
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
          const text = `Hi ${displayName} — your Gift Concierge here. Need help finding a gift for someone? Just tell me who you're shopping for and I'll find something perfect. I'm always here when you need me!`
          await smartWhatsAppSend(user.phone, text, 'churned_60_day', [displayName])
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

  console.log(`[Lifecycle] Done: returning=${results.returningWelcomeBack}, mature=${results.matureFeatureDiscovery}, churned30=${results.churned30}, churned60=${results.churned60}`)
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
