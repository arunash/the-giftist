import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { extractProductFromImage } from '@/lib/extract-image'
import { searchRetailers } from '@/lib/search-retailers'
import { downloadMedia, downloadDocument, sendTextMessage, sendImageMessage, normalizePhone } from '@/lib/whatsapp'
import { buildChatContext, checkChatLimit } from '@/lib/chat-context'
import { stripSpecialBlocks, parseChatContent, type EventData, type AddToEventData, type FeedbackData } from '@/lib/parse-chat-content'
import { createActivity } from '@/lib/activity'
import { calculateGoalAmount } from '@/lib/platform-fee'
import { enrichItem } from '@/lib/enrich-item'
import { createDefaultEventsForUser } from '@/lib/default-events'
import { logApiCall, logError } from '@/lib/api-logger'
import { checkAndSendFunnelMessages, sendFirstItemNudge } from '@/lib/whatsapp-funnel'
import { createTrackedLink } from '@/lib/product-link'
import {
  parseWhatsAppExport,
  identifySenders,
  filterAndSampleMessages,
  extractFriendProfile,
  profileSummary,
  suggestGiftsFromProfile,
} from '@/lib/chat-analysis'
import { isSupportedChatFile, extractChatText } from '@/lib/extract-chat-file'
import { listMonitoredGroups, extractGroupProfiles } from '@/lib/group-monitor'
import Anthropic from '@anthropic-ai/sdk'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
const INSTAGRAM_REGEX = /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i

const client = new Anthropic()

interface PendingProduct {
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  url: string
  domain: string
}

const CONFIRM_WORDS = new Set(['yes', 'yep', 'yeah', 'sure', 'ok', 'add', 'save', 'add it', 'save it', 'yes please', 'y'])
const REJECT_WORDS = new Set(['no', 'nah', 'nope', 'skip', 'cancel', 'n', 'no thanks'])

const WEB_CTAS = [
  '\n\nSee your full visual wishlist at *giftist.ai*',
  '\n\nBrowse trending gifts and manage events at *giftist.ai*',
  '\n\nCreate event wishlists and share with friends at *giftist.ai*',
]

async function getEventPrompt(userId: string): Promise<string> {
  const now = new Date()
  const events = await prisma.event.findMany({
    where: { userId, date: { gte: now } },
    orderBy: { date: 'asc' },
    take: 5,
    select: { id: true, name: true, date: true },
  })
  if (events.length === 0) return ''
  const lines = events.map((ev, i) => {
    const dateStr = new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `  ${i + 1}. ${ev.name} (${dateStr})`
  })
  return `\n\nLink to an event? Reply *event <number>*:\n${lines.join('\n')}`
}

async function linkLastItemToEvent(userId: string, eventIndex: number): Promise<string> {
  const events = await prisma.event.findMany({
    where: { userId, date: { gte: new Date() } },
    orderBy: { date: 'asc' },
    take: 5,
  })
  if (eventIndex < 0 || eventIndex >= events.length) {
    return `Invalid event number. You have ${events.length} upcoming events. Reply *events* to see them.`
  }
  const event = events[eventIndex]

  // Find user's most recently added item
  const lastItem = await prisma.item.findFirst({
    where: { userId },
    orderBy: { addedAt: 'desc' },
  })
  if (!lastItem) return "No items to link. Add a product first."

  // Check if already linked
  const existing = await prisma.eventItem.findFirst({
    where: { itemId: lastItem.id, eventId: event.id },
  })
  if (existing) return `"${lastItem.name}" is already linked to ${event.name}.`

  await prisma.eventItem.create({
    data: { eventId: event.id, itemId: lastItem.id, priority: 0 },
  })

  createActivity({
    userId,
    type: 'EVENT_ITEM_ADDED',
    visibility: 'PUBLIC',
    itemId: lastItem.id,
    metadata: { itemName: lastItem.name, eventName: event.name },
  }).catch(() => {})

  return `Linked *${lastItem.name}* to *${event.name}*`
}

// ================================================================
// GIFT CIRCLE COMMANDS
// ================================================================

async function listCircleMembers(userId: string): Promise<string> {
  const members = await prisma.circleMember.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  })
  if (members.length === 0) {
    return "Your Gift Circle is empty! Add people who gift with you:\n\n*add circle <phone> <name>*\nExample: *add circle 555-123-4567 Mom*"
  }
  const lines = members.map((m, i) => {
    const rel = m.relationship ? ` (${m.relationship})` : ''
    return `${i + 1}. ${m.name || m.phone}${rel}`
  })
  return `Your Gift Circle:\n\n${lines.join('\n')}\n\nTo remove: *remove circle <number>*\nTo add: *add circle <phone> <name>*`
}

async function addCircleMember(userId: string, phone: string, name?: string): Promise<string> {
  const normalized = normalizePhone(phone)
  const existing = await prisma.circleMember.findUnique({
    where: { userId_phone: { userId, phone: normalized } },
  })
  if (existing) {
    return `${existing.name || normalized} is already in your Gift Circle.`
  }
  await prisma.circleMember.create({
    data: {
      userId,
      phone: normalized,
      name: name || null,
      source: 'WHATSAPP',
    },
  })
  return `Added ${name || normalized} to your Gift Circle!`
}

async function removeCircleMember(userId: string, index: number): Promise<string> {
  const members = await prisma.circleMember.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  })
  if (index < 0 || index >= members.length) {
    return `Invalid number. You have ${members.length} people in your circle. Reply *circle* to see them.`
  }
  const target = members[index]
  await prisma.circleMember.delete({ where: { id: target.id } })
  return `Removed ${target.name || target.phone} from your Gift Circle.`
}

// ================================================================
// EVENT REMINDERS
// ================================================================

async function sendEventReminders(userId: string, phone: string): Promise<string> {
  const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const upcomingEvents = await prisma.event.findMany({
    where: {
      userId,
      date: { gte: now, lte: twoWeeksFromNow },
    },
    include: {
      items: {
        include: { item: { select: { name: true, price: true } } },
        take: 5,
      },
    },
    orderBy: { date: 'asc' },
  })

  if (upcomingEvents.length === 0) {
    return "No events within the next 2 weeks. I'll let you know when something's coming up!"
  }

  const members = await prisma.circleMember.findMany({
    where: { userId },
  })

  if (members.length === 0) {
    return `You have ${upcomingEvents.length} event(s) coming up but no one in your Gift Circle yet.\n\nAdd people: *add circle <phone> <name>*`
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, shareId: true },
  })
  const userName = user?.name || 'Your friend'
  const shareUrl = user?.shareId ? `https://giftist.ai/u/${user.shareId}` : 'https://giftist.ai'

  let sentCount = 0
  for (const event of upcomingEvents) {
    const daysUntil = Math.ceil((new Date(event.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const itemList = event.items.map(ei => {
      const p = ei.item.price ? ` (${ei.item.price})` : ''
      return `- ${ei.item.name}${p}`
    }).join('\n')

    const message = `Hi! ${userName} has ${event.name} coming up in ${daysUntil} days and shared their wishlist with you!\n\n${itemList ? `Gift ideas:\n${itemList}\n\n` : ''}View the full list and contribute:\n${shareUrl}`

    for (const member of members) {
      try {
        await sendTextMessage(member.phone, message)
        sentCount++
      } catch (err) {
        console.error(`Failed to send reminder to ${member.phone}:`, err)
      }
    }
  }

  return `Sent reminders to ${sentCount} people about ${upcomingEvents.length} upcoming event(s)!`
}

async function getWebCTA(userId: string): Promise<string> {
  const count = await prisma.item.count({ where: { userId, source: { not: 'SEED' } } })
  // Every 3rd item: if user has 0 circle members, nudge circle instead of web CTA
  if (count > 0 && count % 3 === 0) {
    const circleMemberCount = await prisma.circleMember.count({ where: { userId } })
    if (circleMemberCount === 0) {
      return `\n\nYou have ${count} items saved! Add someone to your Gift Circle so they know what you want: *add circle <phone> <name>*`
    }
  }
  // Show web CTA on 3rd, 7th, 12th item, then every 10th
  if (count === 3 || count === 7 || count === 12 || (count > 12 && count % 10 === 0)) {
    return WEB_CTAS[count % WEB_CTAS.length]
  }
  return ''
}

async function savePendingProduct(
  userId: string,
  listId: string,
  pending: PendingProduct,
  phone: string,
): Promise<string> {
  await prisma.user.update({
    where: { id: userId },
    data: { pendingProduct: null },
  })

  // Dedup: check for existing item with same name or URL
  const existingItem = await prisma.item.findFirst({
    where: {
      userId,
      OR: [
        ...(pending.url ? [{ url: pending.url }] : []),
        { name: { equals: pending.name, mode: 'insensitive' as const } },
      ],
    },
  })
  if (existingItem) {
    const priceStr = pending.price ? ` (${pending.price})` : ''
    return `You already have *${existingItem.name}*${priceStr} on your list!`
  }

  const feeCalc = calculateGoalAmount(pending.priceValue)

  const item = await prisma.item.create({
    data: {
      userId,
      name: pending.name,
      price: pending.price,
      priceValue: pending.priceValue,
      image: pending.image,
      url: pending.url,
      domain: pending.domain,
      source: 'WHATSAPP',
      goalAmount: feeCalc.goalAmount,
    },
  })

  await prisma.giftListItem.create({
    data: { listId, itemId: item.id, addedById: userId },
  })

  createActivity({
    userId,
    type: 'ITEM_ADDED',
    visibility: 'PUBLIC',
    itemId: item.id,
    metadata: { itemName: pending.name, source: 'WHATSAPP' },
  }).catch(() => {})

  sendFirstItemNudge(userId, phone, pending.name).catch(() => {})

  const priceStr = pending.price ? ` (${pending.price})` : ''
  const shareHint = `\n\nTo share your wishlist, reply *share*`
  const webCta = await getWebCTA(userId)
  const eventPrompt = await getEventPrompt(userId)

  if (pending.image) {
    try {
      await sendImageMessage(phone, pending.image, `Added: ${pending.name}${priceStr}${eventPrompt}${shareHint}${webCta}`)
      return ''
    } catch {}
  }

  return `Added: ${pending.name}${priceStr}${eventPrompt}${shareHint}${webCta}`
}

export async function resolveUserAndList(phone: string, profileName?: string) {
  let user = await prisma.user.findUnique({ where: { phone } })
  const isNewUser = !user

  if (!user) {
    user = await prisma.user.create({
      data: { phone, name: profileName || null },
    })
    // Fire-and-forget: create default events for new WhatsApp user
    createDefaultEventsForUser(user.id).catch(() => {})
  } else if (profileName && (!user.name || /^User \d{4}$/.test(user.name))) {
    // Update name from WhatsApp profile if current name is missing or a placeholder
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name: profileName },
    })
  }

  // Find or create "WhatsApp Saves" list
  let list = await prisma.giftList.findFirst({
    where: { userId: user.id, name: 'WhatsApp Saves' },
  })
  if (!list) {
    list = await prisma.giftList.create({
      data: { userId: user.id, name: 'WhatsApp Saves', isPublic: false },
    })
  }

  return { userId: user.id, listId: list.id, isNewUser }
}

const MAX_WHATSAPP_MESSAGE_LENGTH = 4000

export async function handleTextMessage(
  userId: string,
  listId: string,
  text: string,
  phone: string,
): Promise<string> {
  // Truncate excessively long messages to prevent token abuse
  if (text.length > MAX_WHATSAPP_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_WHATSAPP_MESSAGE_LENGTH)
  }
  const trimmed = text.trim().toLowerCase()

  // Fire-and-forget: check funnel stage for engagement messages
  checkAndSendFunnelMessages(userId, phone).catch(() => {})

  // Check for pending product confirmation/rejection
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pendingProduct: true } })
  if (user?.pendingProduct) {
    if (CONFIRM_WORDS.has(trimmed)) {
      let pending: PendingProduct
      try {
        pending = JSON.parse(user.pendingProduct as string) as PendingProduct
      } catch {
        await prisma.user.update({ where: { id: userId }, data: { pendingProduct: null } })
        return "Something went wrong with that product. Send me the link again?"
      }
      return savePendingProduct(userId, listId, pending, phone)
    }
    if (REJECT_WORDS.has(trimmed)) {
      await prisma.user.update({ where: { id: userId }, data: { pendingProduct: null } })
      return "No problem! Send me another photo or link anytime."
    }
    // Any other message clears the pending product (they moved on)
    await prisma.user.update({ where: { id: userId }, data: { pendingProduct: null } })
  }

  // Check for pending chat analysis replies (save, redo, sender number)
  const analysisReply = await handlePendingAnalysisReply(userId, phone, text)
  if (analysisReply) return analysisReply

  // Gift redeem code detection (from WhatsApp redirect flow)
  const giftRedeemMatch = trimmed.match(/redeem code:\s*([a-z0-9]+)/i) || trimmed.match(/^redeem\s+([a-z0-9]+)$/i)
  if (giftRedeemMatch) {
    const code = giftRedeemMatch[1]
    const gift = await prisma.giftSend.findUnique({ where: { redeemCode: code } })
    if (gift && (gift.status === 'PAID' || gift.status === 'NOTIFIED') && !gift.redeemedAt) {
      const giftUrl = `https://giftist.ai/gift/${gift.redeemCode}?direct=1`
      const senderName = gift.recipientName ? `from a friend` : ''
      return `🎁 *You have a gift${senderName}!*\n\n"${gift.itemName}" — $${gift.amount.toFixed(2)}${gift.senderMessage ? `\n"${gift.senderMessage}"` : ''}\n\nTap to redeem: ${giftUrl}`
    } else if (gift?.redeemedAt) {
      return "This gift has already been redeemed."
    }
  }

  // Command: help
  if (trimmed === 'help') {
    return getHelpMessage()
  }

  // Command: list
  if (trimmed === 'list') {
    const items = await prisma.giftListItem.findMany({
      where: { listId },
      include: { item: true },
      orderBy: { addedAt: 'desc' },
      take: 3,
    })
    if (items.length === 0) return "Your list is empty! Send me a product link or photo to get started."
    const lines = items.map((gli, i) => {
      const price = gli.item.price ? ` (${gli.item.price})` : ''
      return `${i + 1}. ${gli.item.name}${price}`
    })
    return `Your recent saves:\n\n${lines.join('\n')}`
  }

  // Command: events
  if (trimmed === 'events') {
    const events = await prisma.event.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      take: 3,
    })
    if (events.length === 0) return "You don't have any events yet. Ask me to create one, or visit *giftist.ai/events*."
    const lines = events.map((ev, i) => {
      const dateStr = new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      return `${i + 1}. ${ev.name} — ${dateStr}`
    })
    return `Your events:\n\n${lines.join('\n')}\n\nTo delete an event, reply *remove event <number>*`
  }

  // Command: remove event <n>
  const removeEventMatch = trimmed.match(/^remove\s+event\s+(\d+)$/)
  if (removeEventMatch) {
    const index = parseInt(removeEventMatch[1]) - 1
    const events = await prisma.event.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      take: 3,
    })
    if (index < 0 || index >= events.length) return `Invalid number. You have ${events.length} events. Reply *events* to see them.`
    const target = events[index]
    await prisma.event.delete({ where: { id: target.id } })
    return `Deleted event: ${target.name}`
  }

  // Command: event <n> — link last-added item to an event
  const eventLinkMatch = trimmed.match(/^event\s+(\d+)$/)
  if (eventLinkMatch) {
    const index = parseInt(eventLinkMatch[1]) - 1
    return linkLastItemToEvent(userId, index)
  }

  // Command: circle — list gift circle members
  if (trimmed === 'circle') {
    return listCircleMembers(userId)
  }

  // Command: add circle <phone> <name>
  const addCircleMatch = text.match(/^add\s+circle\s+([\d\s()+\-]+)\s*(.*)$/i)
  if (addCircleMatch) {
    const phone = addCircleMatch[1].trim()
    const name = addCircleMatch[2]?.trim() || undefined
    return addCircleMember(userId, phone, name)
  }

  // Command: remove circle <n>
  const removeCircleMatch = trimmed.match(/^remove\s+circle\s+(\d+)$/)
  if (removeCircleMatch) {
    const index = parseInt(removeCircleMatch[1]) - 1
    return removeCircleMember(userId, index)
  }

  // Command: remind — send event reminders to gift circle
  if (trimmed === 'remind') {
    return sendEventReminders(userId, phone)
  }

  // Command: groups — list monitored group chats
  if (trimmed === 'groups') {
    return listMonitoredGroups(userId)
  }

  // Command: extract — manually trigger group profile extraction
  if (trimmed === 'extract') {
    await sendTextMessage(phone, 'Analyzing group conversations... This may take a minute.')
    const result = await extractGroupProfiles(userId)
    if (result.extracted === 0) {
      return "Not enough new messages in your group chats yet. I need at least 30 messages from a person before I can build their profile."
    }
    const names = result.updated.slice(0, 5).join(', ')
    return `Updated profiles for: *${names}*${result.updated.length > 5 ? ` and ${result.updated.length - 5} more` : ''}. Ask me for gift ideas for any of them!`
  }

  // Command: edit <n> <field> <value>
  const editMatch = trimmed.match(/^edit\s+(\d+)\s+(name|price)\s+(.+)$/i)
  if (editMatch) {
    const index = parseInt(editMatch[1]) - 1
    const field = editMatch[2].toLowerCase()
    const value = editMatch[3].trim()
    const items = await prisma.giftListItem.findMany({
      where: { listId },
      include: { item: true },
      orderBy: { addedAt: 'desc' },
      take: 3,
    })
    if (index < 0 || index >= items.length) return `Invalid number. You have ${items.length} items. Reply *list* to see them.`
    const target = items[index]

    if (field === 'name') {
      await prisma.item.update({ where: { id: target.item.id }, data: { name: value } })
      return `Updated name: ${value}`
    }

    if (field === 'price') {
      const cleanPrice = value.replace(/^\$/, '')
      const match = cleanPrice.replace(/,/g, '').match(/[\d.]+/)
      const priceValue = match ? parseFloat(match[0]) : null
      const priceStr = priceValue ? `$${priceValue.toFixed(2)}` : value
      await prisma.item.update({ where: { id: target.item.id }, data: { price: priceStr, priceValue } })
      return `Updated price for "${target.item.name}": ${priceStr}`
    }
  }

  // Command: remove <n>
  const removeMatch = trimmed.match(/^remove\s+(\d+)$/)
  if (removeMatch) {
    const index = parseInt(removeMatch[1]) - 1
    const items = await prisma.giftListItem.findMany({
      where: { listId },
      include: { item: true },
      orderBy: { addedAt: 'desc' },
      take: 3,
    })
    if (index < 0 || index >= items.length) return `Invalid number. You have ${items.length} items.`
    const target = items[index]
    await prisma.giftListItem.delete({ where: { id: target.id } })
    return `Removed: ${target.item.name}`
  }

  // Command: share event <n>
  const shareEventMatch = trimmed.match(/^share\s+event\s+(\d+)$/)
  if (shareEventMatch) {
    const index = parseInt(shareEventMatch[1]) - 1
    const events = await prisma.event.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      take: 3,
      select: { id: true, name: true, shareUrl: true },
    })
    if (index < 0 || index >= events.length) {
      return `Invalid event number. You have ${events.length} events. Reply *events* to see them.`
    }
    const event = events[index]
    const sharer = await prisma.user.findUnique({ where: { id: userId }, select: { shareId: true } })
    if (sharer?.shareId && event.shareUrl) {
      const webUrl = `https://giftist.ai/u/${sharer.shareId}?event=${event.shareUrl}`
      return `Here's your *${event.name}* wishlist link:\n\n${webUrl}\n\nShare this with friends and family so they can see what you want and contribute!`
    }
    return "Something went wrong generating your share link. Please try again."
  }

  // Command: taste profile / profiles — explain what taste profiles are
  if (trimmed === 'taste profile' || trimmed === 'taste profiles' || trimmed === 'profiles' || trimmed === 'what is a taste profile') {
    const members = await prisma.circleMember.findMany({
      where: { userId, tasteProfile: { not: null } },
      select: { name: true },
      take: 10,
    })
    const profiledNames = members.filter(m => m.name).map(m => m.name)

    let response = `*Taste Profiles* — How Giftist Learns What People Like

A taste profile is a snapshot of someone's preferences that I build by reading your conversations with them.

*What I extract:*
• Interests & hobbies
• Favorite brands & stores
• Style preferences (aesthetic, vibe)
• Budget range
• Sizes (clothing, shoes, rings)
• Things they dislike (so I avoid bad suggestions)
• Wish statements ("I really want..." quotes from chat)

*How to create one:*
1. Open a WhatsApp chat with the person
2. Tap ⋮ → More → Export Chat
3. Share it with me here

I'll analyze the conversation and build a profile in ~30 seconds. Then whenever you ask for gift ideas for that person, I'll use their profile to suggest things they'll actually love.

*Privacy:* We never store the conversation. It's only used to extract the profile, then immediately discarded.`

    if (profiledNames.length > 0) {
      response += `\n\n*People with profiles:* ${profiledNames.join(', ')}`
    }

    response += `\n\nFree: 2 profiles/day | Credit Pack: 5 more for $5 | Gold: unlimited`
    return response
  }

  // Command: share
  if (trimmed === 'share') {
    const sharer = await prisma.user.findUnique({ where: { id: userId }, select: { shareId: true, name: true } })
    if (sharer?.shareId) {
      const webUrl = `https://giftist.ai/u/${sharer.shareId}`
      return `Here's your shareable link:\n\n${webUrl}\n\nFriends can view your list and contribute to any gift!`
    }
    return "Something went wrong generating your share link. Please try again."
  }

  // Command: view {shareId} — recipient viewing someone's wishlist
  const viewMatch = text.match(/\bview\s+(\S+)/i)
  if (viewMatch) {
    const targetShareId = viewMatch[1]
    const owner = await prisma.user.findUnique({
      where: { shareId: targetShareId },
      select: {
        name: true,
        shareId: true,
        items: {
          orderBy: { addedAt: 'desc' },
          take: 5,
          select: { name: true, price: true, priceValue: true },
        },
      },
    })

    if (!owner) {
      return "I couldn't find that wishlist. The link may have expired or be invalid."
    }

    const ownerName = owner.name || 'Someone'
    const itemLines = owner.items.map((item, i) => {
      const priceStr = item.price ? ` — ${item.price}` : ''
      return `${i + 1}. ${item.name}${priceStr}`
    })

    const itemCount = owner.items.length
    const moreText = itemCount === 5 ? '\n\n...and more!' : ''

    return `Hi! Your friend ${ownerName} is sharing their gift wishlist with you for their special moment! Checkout what they have in mind on the Giftist.\n\n🎁 *${ownerName}'s Wishlist*\n\n${itemLines.join('\n')}${moreText}\n\nView the full list and contribute:\nhttps://giftist.ai/u/${targetShareId}\n\nWant to create your own wishlist? Sign up free at *giftist.ai* — save gifts from any store, create event wishlists, and share with friends!`
  }

  // Command: item {itemId} — view a single item (only items the user owns or from public profiles)
  const itemMatch = text.match(/\bitem\s+(\S+)/i)
  if (itemMatch) {
    const targetItemId = itemMatch[1]
    const item = await prisma.item.findUnique({
      where: { id: targetItemId },
      include: {
        user: { select: { id: true, name: true, shareId: true } },
      },
    })

    if (!item) {
      return "I couldn't find that item. The link may have expired or be invalid."
    }

    // Only allow viewing own items or items from users with public share links
    if (item.user.id !== userId && !item.user.shareId) {
      return "I couldn't find that item. The link may have expired or be invalid."
    }

    const ownerName = item.user.name || 'Someone'
    const priceStr = item.price ? `\n💰 ${item.price}` : ''
    const goalAmount = item.goalAmount || item.priceValue || 0
    const funded = item.fundedAmount || 0
    let fundingStr = ''
    if (goalAmount > 0) {
      const remaining = Math.max(0, goalAmount - funded)
      const pct = Math.min(100, Math.round((funded / goalAmount) * 100))
      fundingStr = `\n📊 ${pct}% funded — $${remaining.toFixed(0)} remaining`
    }

    const webLink = item.user.shareId
      ? `\n\nContribute or see the full wishlist:\nhttps://giftist.ai/u/${item.user.shareId}`
      : ''

    const signupCta = `\n\nCreate your own wishlist free at *giftist.ai*`

    const greeting = `Hi! Your friend ${ownerName} is sharing their gift wishlist with you for their special moment! Checkout what they have in mind on the Giftist.\n\n`

    // Send with image if available
    if (item.image) {
      try {
        await sendImageMessage(
          phone,
          item.image,
          `${greeting}🎁 *${item.name}*${priceStr}${fundingStr}${webLink}${signupCta}`
        )
        return ''
      } catch {}
    }

    return `${greeting}🎁 *${item.name}*${priceStr}${fundingStr}${webLink}${signupCta}`
  }

  // Try to extract URLs
  const urls = text.match(URL_REGEX)
  if (urls && urls.length > 0) {
    const url = urls[0]

    // Instagram links need special handling — scrape OG image, then identify product via vision
    if (INSTAGRAM_REGEX.test(url)) {
      return handleInstagramLink(userId, listId, url, phone)
    }

    // Check for duplicate URL in this user's items
    const existing = await prisma.item.findFirst({
      where: { userId, url },
    })
    if (existing) return `You already saved this: ${existing.name}`

    const product = await extractProductFromUrl(url)

    // Guardrails: don't save items without proper details or image
    if (product.name === product.domain) {
      return "I couldn't extract product details from that link. Could you try a different link or send me a photo of the product?"
    }
    if (!product.image) {
      return `I found *${product.name}* but couldn't get a product image. Could you send me a photo of it?`
    }

    const urlFeeCalc = calculateGoalAmount(product.priceValue)

    const item = await prisma.item.create({
      data: {
        userId,
        name: product.name,
        price: product.price,
        priceValue: product.priceValue,
        image: product.image,
        url: product.url,
        domain: product.domain,
        source: 'WHATSAPP',
        goalAmount: urlFeeCalc.goalAmount,
      },
    })

    await prisma.giftListItem.create({
      data: { listId, itemId: item.id, addedById: userId },
    })

    createActivity({
      userId,
      type: 'ITEM_ADDED',
      visibility: 'PUBLIC',
      itemId: item.id,
      metadata: { itemName: product.name, source: 'WHATSAPP' },
    }).catch(() => {})

    sendFirstItemNudge(userId, phone, product.name).catch(() => {})

    const priceStr = product.price ? ` (${product.price})` : ''
    const shareHint = `\n\nTo share your wishlist, reply *share*`
    const webCta = await getWebCTA(userId)
    const eventPrompt = await getEventPrompt(userId)

    // Reply with product image (guaranteed to exist by guardrails above)
    try {
      await sendImageMessage(phone, product.image, `Added: ${product.name}${priceStr}${eventPrompt}${shareHint}${webCta}`)
      return '' // empty string means we already sent a reply
    } catch {
      // fall through to text reply
    }

    return `Added: ${product.name}${priceStr}${eventPrompt}${shareHint}${webCta}`
  }

  // No URL and not a command — handle as conversational chat via Claude
  return handleChatMessage(userId, text)
}

async function handleInstagramLink(
  userId: string,
  listId: string,
  igUrl: string,
  phone: string,
): Promise<string> {
  // Strip tracking params for clean URL and dedup
  const cleanUrl = igUrl.replace(/\?.*$/, '')

  const existing = await prisma.item.findFirst({
    where: { userId, url: cleanUrl },
  })
  if (existing) return `You already saved this: ${existing.name}`

  // Fetch Instagram page to get OG image and caption
  let ogImage: string | null = null
  let ogCaption: string | null = null
  try {
    const res = await fetch(igUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const cheerio = await import('cheerio')
      const $ = cheerio.load(html)
      ogImage = $('meta[property="og:image"]').attr('content') || null
      ogCaption = $('meta[property="og:description"]').attr('content') || null
    }
  } catch {
    // Fetch failed — continue without OG data
  }

  console.log('[INSTAGRAM] OG image:', !!ogImage, '| caption:', ogCaption?.substring(0, 80))

  // If we got the OG image, run it through the product identification pipeline
  if (ogImage) {
    let imageBuffer: Buffer | null = null
    try {
      // SSRF check on OG image URL
      const ogParsed = new URL(ogImage)
      const { isPrivateUrlResolved } = await import('./url-safety')
      if (await isPrivateUrlResolved(ogParsed)) {
        ogImage = null
      } else {
        const imgRes = await fetch(ogImage, { signal: AbortSignal.timeout(10000) })
        if (imgRes.ok) {
          imageBuffer = Buffer.from(await imgRes.arrayBuffer())
        }
      }
    } catch {
      // Image download failed
    }

    if (imageBuffer) {
      const product = await extractProductFromImage(imageBuffer, 'image/jpeg', ogCaption || undefined)
      console.log('[INSTAGRAM] Vision identified:', product?.name, '| brand:', product?.brand)

      if (product && product.name) {
        const visionName = product.brand ? `${product.brand} ${product.name}` : product.name

        // Search retailers for the identified product
        const { bestResult, results } = await searchRetailers(product.name, product.brand, product.description)
        console.log('[INSTAGRAM] Retailer search:', results.length, 'results | best:', bestResult?.retailer)

        let itemUrl = cleanUrl
        let itemDomain = 'instagram.com'
        let itemImage = ogImage
        let itemPrice = product.price
        let itemPriceValue = product.priceValue

        if (bestResult) {
          itemUrl = bestResult.url
          try {
            itemDomain = new URL(bestResult.url).hostname
          } catch {
            itemDomain = bestResult.retailer.toLowerCase()
          }

          // Scrape retailer page for better image and price
          try {
            const scraped = await extractProductFromUrl(bestResult.url)
            console.log('[INSTAGRAM] Scraped:', scraped.name, '| image:', !!scraped.image, '| price:', scraped.price)
            if (scraped.image) itemImage = scraped.image
            if (scraped.priceValue) {
              itemPrice = scraped.price
              itemPriceValue = scraped.priceValue
            } else if (bestResult.priceValue) {
              itemPrice = bestResult.price
              itemPriceValue = bestResult.priceValue
            }
          } catch {
            if (bestResult.priceValue) {
              itemPrice = bestResult.price
              itemPriceValue = bestResult.priceValue
            }
          }
        }

        // Guardrails: require image for feed display
        if (!itemImage) {
          return `I identified this as *${visionName}*, but couldn't find a product image. Could you send me a direct link to buy it?`
        }

        // Store as pending and ask for confirmation
        const pendingData: PendingProduct = {
          name: visionName,
          price: itemPrice,
          priceValue: itemPriceValue,
          image: itemImage,
          url: itemUrl,
          domain: itemDomain,
        }
        await prisma.user.update({
          where: { id: userId },
          data: { pendingProduct: JSON.stringify(pendingData) },
        })

        const priceStr = itemPrice ? ` (${itemPrice})` : ''

        if (itemImage) {
          try {
            await sendImageMessage(phone, itemImage, `I found *${visionName}*${priceStr} from ${itemDomain}\n\nWant me to add this to your wishlist? Reply *yes* to add.`)
            return ''
          } catch {}
        }

        return `I found *${visionName}*${priceStr}. Want me to add this to your wishlist? Reply *yes* to add.`
      }
    }
  }

  // Guardrails: don't save without an image
  if (!ogImage) {
    return "I couldn't identify the product in that Instagram post. Could you send me a direct product link or a clearer screenshot?"
  }

  // Fallback: store the Instagram link with OG data
  const item = await prisma.item.create({
    data: {
      userId,
      name: ogCaption?.split('\n')[0]?.substring(0, 200) || 'Instagram post',
      image: ogImage,
      url: cleanUrl,
      domain: 'instagram.com',
      source: 'WHATSAPP',
    },
  })

  await prisma.giftListItem.create({
    data: { listId, itemId: item.id, addedById: userId },
  })

  if (ogImage) {
    try {
      await sendImageMessage(phone, ogImage, `Saved from Instagram`)
      return ''
    } catch {}
  }

  return `Saved from Instagram`
}

async function handleChatMessage(userId: string, text: string): Promise<string> {
  // Check daily message limit for free users
  const { allowed, remaining } = await checkChatLimit(userId)
  if (!allowed) {
    // Generate inline checkout link
    try {
      const { stripe } = await import('@/lib/stripe')
      let sub = await prisma.subscription.findUnique({ where: { userId } })
      let custId = sub?.stripeCustomerId
      if (!custId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
        const cust = await stripe.customers.create({ email: user?.email || undefined, metadata: { userId } })
        custId = cust.id
        if (sub) await prisma.subscription.update({ where: { userId }, data: { stripeCustomerId: custId } })
        else await prisma.subscription.create({ data: { userId, stripeCustomerId: custId, status: 'INACTIVE' } })
      }
      const sess = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: custId,
        line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Giftist Credit Pack', description: '50 messages + 5 taste profiles' }, unit_amount: 500 }, quantity: 1 }],
        metadata: { type: 'credit_pack', userId },
        success_url: 'https://giftist.ai/settings?credits=success',
        cancel_url: 'https://giftist.ai',
      })
      return `You've used all your free messages for today.\n\n💳 *Buy a Credit Pack* ($5 for 50 messages + 5 taste profiles):\n${sess.url}\n\nOr upgrade to *Gold* ($4.99/mo) for unlimited: giftist.ai/settings`
    } catch {
      return "You've reached your daily message limit. Visit giftist.ai/settings to buy a Credit Pack or upgrade to Gold!"
    }
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { userId, role: 'USER', content: text },
  })

  // Fetch recent history
  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const messages = history
    .reverse()
    .map((m) => ({
      role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))

  // Build system prompt with user context
  const systemPrompt = await buildChatContext(userId)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }, { timeout: 30000 })

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      userId,
      source: 'WHATSAPP',
    }).catch(() => {})

    const fullContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // Save assistant response
    if (fullContent) {
      await prisma.chatMessage.create({
        data: { userId, role: 'ASSISTANT', content: fullContent },
      })
    }

    // Auto-create events and add items to events from structured blocks
    const segments = parseChatContent(fullContent)
    const eventConfirmations: string[] = []
    const addToEventConfirmations: string[] = []
    const giftCheckoutLinks: string[] = []

    for (const seg of segments) {
      if (seg.type === 'event') {
        const eventData = seg.data as EventData
        try {
          // Dedup: check if event already exists
          const existing = await prisma.event.findFirst({
            where: { userId, name: eventData.name },
          })
          if (!existing) {
            await prisma.event.create({
              data: {
                userId,
                name: eventData.name,
                type: eventData.type,
                date: new Date(eventData.date),
                isPublic: true,
              },
            })
            const dateStr = new Date(eventData.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
            // Check if user has 0 circle members — prompt to add
            const circleCount = await prisma.circleMember.count({ where: { userId } })
            const circlePrompt = circleCount === 0
              ? `\n\nWho should I remind when it's coming up? Just share their number and name — e.g. *add circle 555-123-4567 Dad*`
              : ''
            eventConfirmations.push(`\n\n📅 I've saved ${eventData.name} (${dateStr}) to your events!${circlePrompt}`)
          }
        } catch {}
      }

      if (seg.type === 'add_to_event') {
        const ateData = seg.data as AddToEventData
        try {
          // Resolve itemRef (#N) to real database ID
          let itemId = ateData.itemId
          if (!itemId && ateData.itemRef) {
            const refMatch = ateData.itemRef.match(/#(\d+)/)
            if (refMatch) {
              const idx = parseInt(refMatch[1])
              const userItems = await prisma.item.findMany({
                where: { userId },
                orderBy: { addedAt: 'desc' },
                take: 30,
                select: { id: true },
              })
              if (idx >= 1 && idx <= userItems.length) {
                itemId = userItems[idx - 1].id
              }
            }
          }

          // Create new item if no valid itemId
          if (!itemId || itemId === 'TBD' || itemId === 'new') {
            // Dedup: check for existing item with same name
            const existingItem = await prisma.item.findFirst({
              where: { userId, name: { equals: ateData.itemName, mode: 'insensitive' } },
            })
            if (existingItem) {
              itemId = existingItem.id
            } else {
              // Parse price
              let priceValue: number | null = null
              if (ateData.price) {
                const match = ateData.price.replace(/,/g, '').match(/[\d.]+/)
                if (match) priceValue = parseFloat(match[0])
              }

              const feeCalc = calculateGoalAmount(priceValue)

              const newItem = await prisma.item.create({
                data: {
                  userId,
                  name: ateData.itemName,
                  price: ateData.price || null,
                  priceValue,
                  url: `https://www.google.com/search?q=${encodeURIComponent(ateData.itemName)}`,
                  domain: 'google.com',
                  source: 'WHATSAPP',
                  goalAmount: feeCalc.goalAmount,
                },
              })
              itemId = newItem.id

              // Enrich with real image — await so Vercel doesn't kill it
              await enrichItem(itemId, ateData.itemName).catch(() => {})

              createActivity({
                userId,
                type: 'ITEM_ADDED',
                visibility: 'PUBLIC',
                itemId,
                metadata: { itemName: ateData.itemName, source: 'WHATSAPP' },
              }).catch(() => {})
            }
          }

          // Resolve eventRef (#N) to real database ID
          let resolvedEventId = ateData.eventId
          if (!resolvedEventId && ateData.eventRef) {
            const refMatch = ateData.eventRef.match(/#(\d+)/)
            if (refMatch) {
              const idx = parseInt(refMatch[1])
              const userEvents = await prisma.event.findMany({
                where: { userId, date: { gte: new Date() } },
                orderBy: { date: 'asc' },
                take: 3,
                select: { id: true, name: true },
              })
              console.log('[ADD_TO_EVENT] Resolving eventRef #' + idx, 'from', userEvents.map(e => e.name))
              if (idx >= 1 && idx <= userEvents.length) {
                resolvedEventId = userEvents[idx - 1].id
              }
            }
          }

          // Link item to event — resolve by ID first, fallback to exact name, then fuzzy name
          let eventExists = resolvedEventId
            ? await prisma.event.findFirst({ where: { id: resolvedEventId, userId } })
            : null
          if (!eventExists && ateData.eventName) {
            // Try exact match first
            eventExists = await prisma.event.findFirst({
              where: { userId, name: { equals: ateData.eventName, mode: 'insensitive' } },
              orderBy: { date: 'asc' },
            })
          }
          if (!eventExists && ateData.eventName) {
            // Fuzzy fallback
            eventExists = await prisma.event.findFirst({
              where: { userId, name: { contains: ateData.eventName, mode: 'insensitive' } },
              orderBy: { date: 'asc' },
            })
          }
          if (eventExists && itemId) {
            // Remove existing event mappings first
            await prisma.eventItem.deleteMany({ where: { itemId } })
            await prisma.eventItem.create({
              data: { eventId: eventExists.id, itemId, priority: 0 },
            })

            createActivity({
              userId,
              type: 'EVENT_ITEM_ADDED',
              visibility: 'PUBLIC',
              itemId,
              metadata: { itemName: ateData.itemName, eventName: eventExists.name },
            }).catch(() => {})

            // Build share link for immediate access
            let shareLink = ''
            const shareUser = await prisma.user.findUnique({ where: { id: userId }, select: { shareId: true } })
            if (shareUser?.shareId && eventExists.shareUrl) {
              shareLink = `\nView: https://giftist.ai/u/${shareUser.shareId}?event=${eventExists.shareUrl}`
            } else if (shareUser?.shareId) {
              shareLink = `\nView: https://giftist.ai/u/${shareUser.shareId}`
            }

            addToEventConfirmations.push(`✅ Added "${ateData.itemName}" to ${ateData.eventName}${shareLink}`)
          }
        } catch (err) {
          console.error('WhatsApp ADD_TO_EVENT error:', err)
        }
      }

      if (seg.type === 'add_circle') {
        const data = seg.data as import('@/lib/parse-chat-content').AddCircleData
        try {
          const phone = normalizePhone(data.phone)
          await prisma.circleMember.upsert({
            where: { userId_phone: { userId, phone } },
            update: { name: data.name ?? undefined, relationship: data.relationship ?? undefined },
            create: { userId, phone, name: data.name || null, relationship: data.relationship || null, source: 'WHATSAPP' },
          })
          addToEventConfirmations.push(`Added ${data.name || phone} to your Gift Circle`)
        } catch (err) {
          console.error('WhatsApp ADD_CIRCLE error:', err)
        }
      }

      if (seg.type === 'remove_circle') {
        const data = seg.data as import('@/lib/parse-chat-content').RemoveCircleData
        try {
          const member = await prisma.circleMember.findFirst({
            where: { userId, name: { contains: data.name, mode: 'insensitive' } },
          })
          if (member) {
            await prisma.circleMember.delete({ where: { id: member.id } })
            addToEventConfirmations.push(`Removed ${member.name || member.phone} from your Gift Circle`)
          }
        } catch (err) {
          console.error('WhatsApp REMOVE_CIRCLE error:', err)
        }
      }

      if (seg.type === 'send_reminders') {
        const data = seg.data as import('@/lib/parse-chat-content').SendRemindersData
        try {
          const members = await prisma.circleMember.findMany({ where: { userId } })
          const reminderUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, shareId: true },
          })
          if (members.length > 0 && reminderUser?.shareId) {
            const shareUrl = `https://giftist.ai/u/${reminderUser.shareId}`
            const userName = reminderUser.name || 'Your friend'
            const msg = `Hi! ${userName} shared their wishlist for ${data.eventName} with you!\n\nView and contribute:\n${shareUrl}`
            let sent = 0
            for (const m of members) {
              try {
                await sendTextMessage(m.phone, msg)
                sent++
              } catch {}
            }
            addToEventConfirmations.push(`Sent reminders to ${sent} people about ${data.eventName}`)
          }
        } catch (err) {
          console.error('WhatsApp SEND_REMINDERS error:', err)
        }
      }

      if (seg.type === 'share_event') {
        const data = seg.data as import('@/lib/parse-chat-content').ShareEventData
        try {
          // Resolve eventRef to real event
          let event: { id: string; name: string; shareUrl: string | null } | null = null
          if (data.eventRef) {
            const refMatch = data.eventRef.match(/#(\d+)/)
            if (refMatch) {
              const idx = parseInt(refMatch[1])
              const userEvents = await prisma.event.findMany({
                where: { userId, date: { gte: new Date() } },
                orderBy: { date: 'asc' },
                take: 3,
                select: { id: true, name: true, shareUrl: true },
              })
              if (idx >= 1 && idx <= userEvents.length) {
                event = userEvents[idx - 1]
              }
            }
          }
          if (!event && data.eventName) {
            event = await prisma.event.findFirst({
              where: { userId, name: { contains: data.eventName, mode: 'insensitive' } },
              select: { id: true, name: true, shareUrl: true },
            })
          }
          if (event?.shareUrl) {
            const shareUser = await prisma.user.findUnique({ where: { id: userId }, select: { shareId: true } })
            if (shareUser?.shareId) {
              const link = `https://giftist.ai/u/${shareUser.shareId}?event=${event.shareUrl}`
              addToEventConfirmations.push(`\nHere's your *${event.name}* wishlist link:\n${link}`)
            }
          }
        } catch (err) {
          console.error('WhatsApp SHARE_EVENT error:', err)
        }
      }

      if (seg.type === 'feedback') {
        const data = seg.data as FeedbackData
        try {
          await prisma.feedback.create({
            data: {
              userId,
              rating: data.rating,
              comment: data.comment || null,
              source: 'WHATSAPP',
            },
          })
        } catch (err) {
          console.error('WhatsApp FEEDBACK save error:', err)
        }
      }

      if (seg.type === 'update_profile') {
        try {
          const { circleMemberRef, updates } = seg.data as { circleMemberRef: string; updates: Record<string, any> }
          const idx = parseInt(circleMemberRef.replace(/^C/i, '')) - 1
          const members = await prisma.circleMember.findMany({
            where: { userId },
            orderBy: { name: 'asc' },
            take: 20,
          })
          const member = members[idx]
          if (member) {
            const existing = member.tasteProfile ? JSON.parse(member.tasteProfile) : {}
            // Merge arrays, overwrite scalars
            for (const [key, val] of Object.entries(updates)) {
              if (Array.isArray(val) && Array.isArray(existing[key])) {
                const merged = [...existing[key], ...val]
                existing[key] = [...new Set(merged)].slice(0, 15)
              } else {
                existing[key] = val
              }
            }
            await prisma.circleMember.update({
              where: { id: member.id },
              data: { tasteProfile: JSON.stringify(existing), profileUpdatedAt: new Date() },
            })
          }
        } catch (err) {
          console.error('WhatsApp UPDATE_PROFILE error:', err)
        }
      }

      if (seg.type === 'send_gift') {
        try {
          const giftData = seg.data as import('@/lib/parse-chat-content').SendGiftData
          // Resolve phone from circle member ref if needed
          let recipientPhone = giftData.recipientPhone
          if (!recipientPhone && giftData.recipientRef) {
            const idx = parseInt(giftData.recipientRef.replace(/^C/i, '')) - 1
            const members = await prisma.circleMember.findMany({
              where: { userId },
              orderBy: { name: 'asc' },
              take: 20,
            })
            const member = members[idx]
            if (member) recipientPhone = member.phone
          }

          if (recipientPhone) {
            const amount = giftData.itemPrice
            const platformFee = Math.round(amount * 0.05 * 100) / 100
            const totalCharged = Math.round((amount + platformFee) * 100) / 100

            const giftSend = await prisma.giftSend.create({
              data: {
                senderId: userId,
                recipientPhone: recipientPhone.replace(/\D/g, ''),
                recipientName: giftData.recipientName || null,
                itemName: giftData.itemName,
                itemPrice: amount,
                itemUrl: giftData.itemUrl || null,
                itemImage: giftData.itemImage || null,
                senderMessage: giftData.senderMessage || null,
                amount,
                platformFee,
                totalCharged,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            })

            // Create Stripe checkout link and send via WhatsApp
            const { stripe } = await import('@/lib/stripe')
            const stripeSession = await stripe.checkout.sessions.create({
              mode: 'payment',
              line_items: [{
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `Gift: ${giftData.itemName}`,
                    description: `Send "${giftData.itemName}" to ${giftData.recipientName || 'your friend'}`,
                  },
                  unit_amount: Math.round(totalCharged * 100),
                },
                quantity: 1,
              }],
              metadata: {
                type: 'gift_send',
                giftSendId: giftSend.id,
                userId,
              },
              success_url: `https://giftist.ai/gift/sent?id=${giftSend.id}`,
              cancel_url: 'https://giftist.ai',
            })

            await prisma.giftSend.update({
              where: { id: giftSend.id },
              data: { stripeSessionId: stripeSession.id },
            })

            // Store checkout link to append to reply
            giftCheckoutLinks.push(`\n\n💳 Pay here to send the gift: ${stripeSession.url}`)
          }
        } catch (err) {
          console.error('WhatsApp SEND_GIFT error:', err)
        }
      }
    }

    // Extract product blocks, create tracked links, and auto-save to wishlist
    // Every product MUST have a link. Images resolve on the landing page when clicked.
    const productSegments = segments.filter(s => s.type === 'product')
    let productList = ''
    let autoSavedCount = 0
    if (productSegments.length > 0) {
      const { findProductUrl } = await import('@/lib/enrich-item')
      const lines: string[] = []
      let displayIdx = 0
      for (let i = 0; i < productSegments.length; i++) {
        const p = productSegments[i].data as import('@/lib/parse-chat-content').ProductData
        const price = p.price ? ` — ${p.price}` : ''
        let linkLine = ''

        // Resolve a real product URL if Claude didn't provide one
        let targetUrl = p.url && !p.url.includes('google.com/search') ? p.url : null
        if (!targetUrl) {
          try {
            const found = await findProductUrl(p.name)
            if (found?.url) targetUrl = found.url
          } catch {}
        }

        // Create Giftist product page link (landing page resolves images via 3-layer system)
        if (targetUrl) {
          try {
            let priceVal: number | null = null
            if (p.price) {
              const m = p.price.replace(/,/g, '').match(/[\d.]+/)
              if (m) priceVal = parseFloat(m[0])
            }
            const trackedUrl = await createTrackedLink({
              productName: p.name,
              targetUrl,
              price: p.price || null,
              priceValue: priceVal,
              image: p.image || null,
              userId,
              source: 'WHATSAPP',
            })
            linkLine = `\n${trackedUrl}`
          } catch {}
        }

        // Only show products that have links
        if (!linkLine) continue

        displayIdx++
        lines.push(`${displayIdx}. *${p.name}*${price}${linkLine}`)

        // Auto-save: create item if it doesn't already exist (no itemRef = new suggestion)
        if (!p.id && p.name) {
          try {
            const existingItem = await prisma.item.findFirst({
              where: {
                userId,
                OR: [
                  ...(p.url ? [{ url: p.url }] : []),
                  { name: { equals: p.name, mode: 'insensitive' as const } },
                ],
              },
            })
            if (!existingItem) {
              let priceValue: number | null = null
              if (p.price) {
                const match = p.price.replace(/,/g, '').match(/[\d.]+/)
                if (match) priceValue = parseFloat(match[0])
              }

              const feeCalc = calculateGoalAmount(priceValue)
              const newItem = await prisma.item.create({
                data: {
                  userId,
                  name: p.name,
                  price: p.price || null,
                  priceValue,
                  url: p.url || `https://www.google.com/search?q=${encodeURIComponent(p.name)}`,
                  domain: p.url ? (() => { try { return new URL(p.url).hostname } catch { return 'unknown' } })() : 'google.com',
                  source: 'WHATSAPP_AI',
                  goalAmount: feeCalc.goalAmount,
                },
              })

              // Add to user's default gift list
              const giftList = await prisma.giftList.findFirst({
                where: { userId, name: 'WhatsApp Saves' },
              })
              if (giftList) {
                await prisma.giftListItem.create({
                  data: { listId: giftList.id, itemId: newItem.id, addedById: userId },
                })
              }

              // Enrich with real image in background
              enrichItem(newItem.id, p.name).catch(() => {})

              createActivity({
                userId,
                type: 'ITEM_ADDED',
                visibility: 'PUBLIC',
                itemId: newItem.id,
                metadata: { itemName: p.name, source: 'WHATSAPP_AI' },
              }).catch(() => {})

              autoSavedCount++
            }
          } catch (err) {
            console.error('WhatsApp auto-save product error:', err)
          }
        }
      }
      productList = lines.join('\n') + '\n\n'
    }

    // Strip product/preference/event blocks for WhatsApp (plain text only)
    const strippedContent = stripSpecialBlocks(fullContent) || "I'm your Gift Concierge — ask me about gift ideas, what's trending, or anything on your wishlist."

    const ateSection = addToEventConfirmations.length > 0
      ? '\n\n' + addToEventConfirmations.join('\n')
      : ''

    // Auto-save confirmation
    const autoSaveNote = autoSavedCount > 0
      ? `\n\nI've added ${autoSavedCount} item${autoSavedCount > 1 ? 's' : ''} to your wishlist! View at *giftist.ai*`
      : ''

    // Periodic web CTA — skip if we already have a giftist.ai mention from ateSection or autoSaveNote
    let chatWebCta = ''
    if (!ateSection && !autoSaveNote) {
      const msgCount = await prisma.chatMessage.count({ where: { userId, role: 'USER' } })
      if (msgCount > 0 && msgCount % 5 === 0) {
        chatWebCta = '\n\nFor product cards, trending gifts, and event wishlists — visit *giftist.ai*'
      }
    }

    return strippedContent + (productList ? '\n\n' + productList.trimEnd() : '') + eventConfirmations.join('') + ateSection + autoSaveNote + giftCheckoutLinks.join('') + chatWebCta
  } catch (error) {
    console.error('WhatsApp chat error:', error)
    logError({ source: 'WHATSAPP_WEBHOOK', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return "Sorry, I couldn't process that right now. Try sending a product link, photo, or type *help* for instructions."
  }
}

export async function handleImageMessage(
  userId: string,
  listId: string,
  mediaId: string,
  mimeType: string,
  caption: string | undefined,
  phone: string,
): Promise<string> {
  // If caption contains a URL, prefer URL extraction
  if (caption) {
    const urls = caption.match(URL_REGEX)
    if (urls && urls.length > 0) {
      return handleTextMessage(userId, listId, caption, phone)
    }
  }

  let imageBuffer: Buffer
  try {
    imageBuffer = await downloadMedia(mediaId)
  } catch (e) {
    return "Couldn't download the image. Please try again."
  }

  const product = await extractProductFromImage(imageBuffer, mimeType, caption)
  if (!product) {
    return "Couldn't identify a product. Try sending a link instead."
  }

  const visionName = product.brand ? `${product.brand} ${product.name}` : product.name
  console.log('[IMAGE] Vision identified:', visionName, '| brand:', product.brand, '| price:', product.price)

  // Search retailers for a real product link
  const { bestResult, results } = await searchRetailers(product.name, product.brand, product.description)
  console.log('[IMAGE] Retailer search results:', results.length, '| best:', bestResult?.retailer, bestResult?.url)

  let itemUrl = 'whatsapp://image'
  let itemDomain = 'whatsapp'
  let itemImage: string | null = null
  let itemPrice = product.price
  let itemPriceValue = product.priceValue

  if (bestResult) {
    itemUrl = bestResult.url
    try {
      itemDomain = new URL(bestResult.url).hostname
    } catch {
      itemDomain = bestResult.retailer.toLowerCase()
    }

    // Try to scrape the retailer page for an image and better price
    try {
      const scraped = await extractProductFromUrl(bestResult.url)
      console.log('[IMAGE] Scraped:', scraped.name, '| image:', !!scraped.image, '| price:', scraped.price)
      if (scraped.image) itemImage = scraped.image
      // Price priority: scraped > search result > vision-extracted
      if (scraped.priceValue) {
        itemPrice = scraped.price
        itemPriceValue = scraped.priceValue
      } else if (bestResult.priceValue) {
        itemPrice = bestResult.price
        itemPriceValue = bestResult.priceValue
      }
    } catch (e) {
      console.log('[IMAGE] Scrape failed:', (e as Error).message)
      // Scrape failed — use search result price if available
      if (bestResult.priceValue) {
        itemPrice = bestResult.price
        itemPriceValue = bestResult.priceValue
      }
    }
  }

  console.log('[IMAGE] Final:', { url: itemUrl, domain: itemDomain, image: !!itemImage, price: itemPrice })

  // Guardrails: require real URL and image before saving
  if (itemUrl === 'whatsapp://image' || !itemImage) {
    return `I identified this as *${visionName}*, but couldn't get complete product details. Could you send me a direct product link instead?`
  }

  // Store as pending and ask for confirmation
  const pendingData: PendingProduct = {
    name: visionName,
    price: itemPrice,
    priceValue: itemPriceValue,
    image: itemImage,
    url: itemUrl,
    domain: itemDomain,
  }
  await prisma.user.update({
    where: { id: userId },
    data: { pendingProduct: JSON.stringify(pendingData) },
  })

  const priceStr = itemPrice ? ` (${itemPrice})` : ''

  if (itemImage) {
    try {
      await sendImageMessage(phone, itemImage, `I found *${visionName}*${priceStr} from ${itemDomain}\n\nWant me to add this to your wishlist? Reply *yes* to add.`)
      return ''
    } catch {}
  }

  return `I found *${visionName}*${priceStr}. Want me to add this to your wishlist? Reply *yes* to add.`
}

export function getWelcomeMessage(name?: string): string {
  const greeting = name ? `Hi ${name}!` : 'Hi there!'
  return `${greeting} Welcome to *The Giftist* — I'm your personal gift concierge.

Here's how it works:
1. *Tell me who you're shopping for* — I'll suggest the perfect gift
2. *Save items* — Send me a link or photo and I'll add it to your wishlist
3. *Link to events* — Tell me about birthdays, holidays, or celebrations
4. *Add your circle* — Share phone numbers of friends and family

Who are you shopping for? Tell me about someone special and I'll find the perfect gift!`
}

export function getHelpMessage(): string {
  return `*The Giftist* — Your Gift Concierge

*Items:*
- *Send a link* — I'll save it to your list
- *Send a photo* — I'll identify it and add it
- *list* — See your recent saves
- *remove <number>* — Remove an item
- *edit <number> name <new name>* — Rename an item
- *edit <number> price <new price>* — Update price

*Events:*
- *events* — See your events
- *event <number>* — Link last item to an event
- *remove event <number>* — Delete an event

*Gift Circle:*
- *circle* — See your gift circle
- *add circle <phone> <name>* — Add someone
- *remove circle <number>* — Remove someone
- *remind* — Send reminders to your circle about upcoming events

*Taste Profiles (learn friends' preferences):*
- *taste profile* — What is a taste profile?
- *Share a WhatsApp chat export* — Build a profile from your conversations
- *Add me to a group chat* — I'll learn preferences automatically
- *groups* — See monitored group chats
- *extract* — Analyze group messages now

*Other:*
- *Ask me anything* — Gift ideas, trends, recs
- *share* — Get your shareable wishlist link
- *share event <number>* — Get a link for a specific event's wishlist

*On the web (giftist.ai):*
- Visual wishlist with trending gifts
- Event wishlists and group gifting
- AI-powered gift recommendations`
}

// ── Pending chat analysis state (in-memory, keyed by userId) ──
// Stored temporarily during the multi-step document analysis flow

interface PendingAnalysis {
  senders: { name: string; count: number }[]
  messages: import('@/lib/chat-analysis').ParsedMessage[]
  profile?: import('@/lib/chat-analysis').FriendProfile
  friendName?: string
  expiresAt: number
}

const pendingAnalysisMap = new Map<string, PendingAnalysis>()

// Clean up expired entries periodically
function cleanupPending() {
  const now = Date.now()
  for (const [key, val] of pendingAnalysisMap) {
    if (now > val.expiresAt) pendingAnalysisMap.delete(key)
  }
}

export function getPendingAnalysis(userId: string): PendingAnalysis | undefined {
  cleanupPending()
  return pendingAnalysisMap.get(userId)
}

export function clearPendingAnalysis(userId: string) {
  pendingAnalysisMap.delete(userId)
}

// ── Document Message Handler ──

export async function handleDocumentMessage(
  userId: string,
  listId: string,
  mediaId: string,
  mimeType: string,
  filename: string | undefined,
  phone: string,
): Promise<string> {
  if (!isSupportedChatFile(mimeType, filename)) {
    return "I can analyze WhatsApp chat exports. To export a chat: open a WhatsApp conversation → tap ⋮ (menu) → More → Export Chat, then send me the file."
  }

  // Check taste profile limit
  const { checkProfileLimit } = await import('@/lib/chat-context')
  const { allowed: profileAllowed } = await checkProfileLimit(userId)
  if (!profileAllowed) {
    // Generate inline checkout link for profile limit
    try {
      const { stripe } = await import('@/lib/stripe')
      let sub = await prisma.subscription.findUnique({ where: { userId } })
      let custId = sub?.stripeCustomerId
      if (!custId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
        const cust = await stripe.customers.create({ email: user?.email || undefined, metadata: { userId } })
        custId = cust.id
        if (sub) await prisma.subscription.update({ where: { userId }, data: { stripeCustomerId: custId } })
        else await prisma.subscription.create({ data: { userId, stripeCustomerId: custId, status: 'INACTIVE' } })
      }
      const sess = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: custId,
        line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Giftist Credit Pack', description: '50 messages + 5 taste profiles' }, unit_amount: 500 }, quantity: 1 }],
        metadata: { type: 'credit_pack', userId },
        success_url: 'https://giftist.ai/settings?credits=success',
        cancel_url: 'https://giftist.ai',
      })
      return `You've used your 2 free taste profile analyses for today.\n\n💳 *Buy a Credit Pack* ($5 for 50 messages + 5 profiles):\n${sess.url}\n\nOr upgrade to *Gold* ($4.99/mo) for unlimited: giftist.ai/settings`
    } catch {
      return "You've used your 2 free taste profile analyses for today. Visit giftist.ai/settings to buy a Credit Pack or upgrade to Gold!"
    }
  }

  let buffer: Buffer
  try {
    buffer = await downloadDocument(mediaId)
  } catch (e) {
    console.error('[DOC] Download failed:', e)
    return "Couldn't download the file. Please try again."
  }

  const text = await extractChatText(buffer, mimeType, filename)
  if (!text) {
    return "Couldn't read that file. Make sure you're sending a WhatsApp chat export — open a conversation → tap ⋮ → More → Export Chat, then send me the file."
  }

  const messages = parseWhatsAppExport(text)

  if (messages.length < 10) {
    return "This doesn't look like a WhatsApp chat export, or the chat is too short. To export: open a WhatsApp conversation → tap ⋮ (menu) → More → Export Chat → Without Media."
  }

  const senders = identifySenders(messages)

  // If it's a 1:1 chat (2 senders), try to auto-pick the friend
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })

  if (senders.length === 2) {
    // Auto-pick: the sender whose name doesn't match the Giftist user
    const userName = user?.name?.toLowerCase() || ''
    const friend = senders.find(s => !s.name.toLowerCase().includes(userName) && !userName.includes(s.name.toLowerCase()))
    const friendName = friend?.name || senders[1].name // fallback to less frequent sender

    // Store messages and run extraction
    const filtered = filterAndSampleMessages(messages, friendName)
    if (filtered.length < 5) {
      const count = filtered.length
      return "Not enough messages from " + friendName + " to analyze (found " + count + "). Try a longer chat."
    }

    const analyzeMsg = "Analyzing " + filtered.length + " messages from " + friendName + "... This may take a moment."
    await sendTextMessage(phone, analyzeMsg)

    try {
      const profile = await extractFriendProfile(filtered, friendName)

      // Store pending for confirmation
      pendingAnalysisMap.set(userId, {
        senders,
        messages,
        profile,
        friendName,
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 min expiry
      })

      const summary = profileSummary(profile, friendName)
      const suggestions = await suggestGiftsFromProfile(profile, friendName, { userId, source: 'WHATSAPP' }).catch(() => [])
      const suggestionsText = suggestions.length > 0
        ? '\n\n🎁 *Gift ideas for ' + friendName + ':*\n' + suggestions.map((s, i) => `${i + 1}. *${s.name}* (${s.price}) — ${s.reason}${s.url ? '\n' + s.url : ''}`).join('\n')
        : ''
      return summary + suggestionsText + "\n\nReply *save* to save this profile to your Gift Circle, or *redo* to try a different person."
    } catch (e) {
      console.error('[DOC] Analysis failed:', e)
      return "Something went wrong analyzing the chat. Please try again."
    }
  }

  // Group chat or 3+ senders — ask user to pick
  pendingAnalysisMap.set(userId, {
    senders,
    messages,
    expiresAt: Date.now() + 30 * 60 * 1000,
  })

  let reply = "I found " + messages.length + " messages from " + senders.length + " people:\n"
  senders.forEach((s, i) => {
    reply += "\n" + (i + 1) + ". " + s.name + " (" + s.count + " messages)"
  })
  reply += "\n\nReply with the *number* of the person you want me to analyze."
  return reply
}

// ── Handle pending analysis replies (called from handleTextMessage) ──

export async function handlePendingAnalysisReply(
  userId: string,
  phone: string,
  text: string,
): Promise<string | null> {
  const pending = pendingAnalysisMap.get(userId)
  if (!pending) return null

  const lower = text.toLowerCase().trim()

  // Save confirmed profile
  if (lower === 'save' && pending.profile && pending.friendName) {
    const existing = await prisma.circleMember.findFirst({
      where: { userId, name: pending.friendName },
    })

    if (existing) {
      await prisma.circleMember.update({
        where: { id: existing.id },
        data: {
          tasteProfile: JSON.stringify(pending.profile),
          profileUpdatedAt: new Date(),
        },
      })
    } else {
      await prisma.circleMember.create({
        data: {
          userId,
          phone: "chat-" + Date.now(),
          name: pending.friendName,
          source: 'WHATSAPP',
          tasteProfile: JSON.stringify(pending.profile),
          profileUpdatedAt: new Date(),
        },
      })
    }

    clearPendingAnalysis(userId)
    return "Saved " + pending.friendName + "'s taste profile to your Gift Circle! Now when you ask me for gift ideas for " + pending.friendName + ", I'll use what I learned.\n\nTry: \"What should I get " + pending.friendName + " for their birthday?\""
  }

  // Redo — re-show sender list
  if (lower === 'redo') {
    pending.profile = undefined
    pending.friendName = undefined

    let reply = "Pick someone to analyze:\n"
    pending.senders.forEach((s, i) => {
      reply += "\n" + (i + 1) + ". " + s.name + " (" + s.count + " messages)"
    })
    reply += "\n\nReply with the *number* of the person."
    return reply
  }

  // Number selection for sender
  const num = parseInt(lower)
  if (!isNaN(num) && num >= 1 && num <= pending.senders.length && !pending.profile) {
    const sender = pending.senders[num - 1]
    const filtered = filterAndSampleMessages(pending.messages, sender.name)

    if (filtered.length < 5) {
      return "Not enough messages from " + sender.name + " to analyze (found " + filtered.length + "). Pick someone else or try a longer chat."
    }

    const progressMsg = "Analyzing " + filtered.length + " messages from " + sender.name + "... This may take a moment."
    await sendTextMessage(phone, progressMsg)

    try {
      const profile = await extractFriendProfile(filtered, sender.name)
      pending.profile = profile
      pending.friendName = sender.name

      const summary = profileSummary(profile, sender.name)
      const suggestions = await suggestGiftsFromProfile(profile, sender.name, { userId, source: 'WHATSAPP' }).catch(() => [])
      const suggestionsText = suggestions.length > 0
        ? '\n\n🎁 *Gift ideas for ' + sender.name + ':*\n' + suggestions.map((s, i) => `${i + 1}. *${s.name}* (${s.price}) — ${s.reason}${s.url ? '\n' + s.url : ''}`).join('\n')
        : ''
      return summary + suggestionsText + "\n\nReply *save* to save this profile to your Gift Circle, or *redo* to try a different person."
    } catch (e) {
      console.error('[DOC] Analysis failed:', e)
      return "Something went wrong analyzing the chat. Please try again."
    }
  }

  // No match — not a pending analysis reply
  return null
}
