import { prisma } from './db'
import { smartWhatsAppSend } from './notifications'

interface FunnelState {
  welcome?: boolean
  firstItem?: boolean
  day1Nudge?: boolean
  day3EventPrompt?: boolean
  day5CirclePrompt?: boolean
  weeklyDigestSent?: string // ISO date of last weekly digest
  reengagementSent?: string // ISO date of last re-engagement
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

  const text = `Nice pick! "${itemName}" is saved to your wishlist.\n\nPro tip: Create an event (like "Mom's Birthday") and I'll help you organize gifts for it. Just say something like "Create an event for Mom's birthday on March 15"`
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
        const text = `Hey ${displayName}! Your Gift Concierge here. You've saved ${user._count.items} item(s) so far.\n\nBuilding a bigger wishlist helps your friends and family find the perfect gift for you. Try:\n- Sending me a link from any store\n- Telling me your interests so I can suggest trending gifts\n- Sending a screenshot of something you spotted online\n\nWhat are you eyeing lately?`
        await smartWhatsAppSend(user.phone, text, 'welcome_message', [displayName])
        results.nudges++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Stage 4: Day 3 event prompt (no events created)
      if (!state.day3EventPrompt && daysSinceSignup >= 3 && user._count.events === 0) {
        state.day3EventPrompt = true
        const text = `Quick question — do you have any birthdays, holidays, or celebrations coming up?\n\nI can help you plan gifts and even remind your friends and family to contribute. Just tell me about an upcoming event!`
        await smartWhatsAppSend(user.phone, text, 'welcome_message', [displayName])
        results.eventPrompts++
        await updateFunnelStage(user.id, state)
        continue
      }

      // Stage 5: Day 5 circle prompt (no circle members)
      if (!state.day5CirclePrompt && daysSinceSignup >= 5 && user._count.circleMembers === 0) {
        state.day5CirclePrompt = true
        const text = `Did you know you can build a Gift Circle? Add your close friends and family, and I'll help coordinate gift-giving for everyone.\n\nTry: *add circle 555-123-4567 Mom*\n\nYour circle members will be able to see your wishlist and contribute to gifts!`
        await smartWhatsAppSend(user.phone, text, 'welcome_message', [displayName])
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
            text += `\n\nReply with anything to keep chatting!`
            await smartWhatsAppSend(user.phone, text, 'welcome_message', [displayName])
            state.weeklyDigestSent = now.toISOString()
            results.weeklyDigests++
            await updateFunnelStage(user.id, state)
            continue
          }
        }
      }

      // Stage 7: Event countdown (7 days before event) — handled in weekly digest above

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
          const text = `Hey ${displayName}! Your Gift Concierge misses you.\n\nYou have ${user._count.items} item(s) on your wishlist${user._count.events > 0 ? ` and ${user._count.events} upcoming event(s)` : ''}.\n\nReply anytime — I'm here to help with all things gifting!`
          await smartWhatsAppSend(user.phone, text, 'welcome_message', [displayName])
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

async function updateFunnelStage(userId: string, state: FunnelState) {
  await prisma.user.update({
    where: { id: userId },
    data: { funnelStage: JSON.stringify(state) },
  })
}
