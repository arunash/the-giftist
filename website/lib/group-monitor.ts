import { prisma } from '@/lib/db'
import { sendTextMessage, normalizePhone } from '@/lib/whatsapp'
import {
  filterAndSampleMessages,
  extractFriendProfile,
  profileSummary,
  type ParsedMessage,
} from '@/lib/chat-analysis'
import { logError } from '@/lib/api-logger'

// Minimum messages before we run extraction for a sender
const MIN_MESSAGES_FOR_EXTRACTION = 30
// How often to re-extract (24 hours)
const EXTRACTION_COOLDOWN_MS = 24 * 60 * 60 * 1000

// ── Handle a group message from the webhook ──

export async function handleGroupMessage(
  waMessageId: string,
  groupId: string,
  senderPhone: string,
  senderName: string | undefined,
  content: string,
) {
  const phone = normalizePhone(senderPhone)

  // Find the Giftist user who added us to this group
  let groupChat = await prisma.groupChat.findFirst({
    where: { groupId, isActive: true },
  })

  if (!groupChat) {
    // Auto-claim: if the sender is a known Giftist user, claim the group for them
    const senderUser = await prisma.user.findUnique({ where: { phone } })
    if (senderUser) {
      await prisma.groupChat.create({
        data: {
          userId: senderUser.id,
          groupId,
        },
      })
      groupChat = await prisma.groupChat.findFirst({
        where: { groupId, isActive: true },
      })

      // Notify the user via DM that we're now monitoring
      sendTextMessage(phone,
        `I noticed you added me to a group chat! I'll quietly listen and learn your friends' gift preferences from the conversation. Reply *groups* to manage monitored chats.`
      ).catch(() => {})
    } else {
      // Buffer as unclaimed — will be linked when a user claims it
      await prisma.groupChatMessage.create({
        data: {
          userId: 'unclaimed',
          groupId,
          senderPhone: phone,
          senderName: senderName || null,
          content,
          waMessageId,
        },
      })
      return
    }
  }

  if (!groupChat) return

  // Don't buffer the owner's own messages (we want friend messages)
  const owner = await prisma.user.findUnique({
    where: { id: groupChat.userId },
    select: { phone: true },
  })
  const ownerPhone = owner?.phone ? normalizePhone(owner.phone) : null
  if (ownerPhone === phone) return

  // Buffer the message
  await prisma.groupChatMessage.create({
    data: {
      userId: groupChat.userId,
      groupId,
      senderPhone: phone,
      senderName: senderName || null,
      content,
      waMessageId,
    },
  })

  // Increment message count
  await prisma.groupChat.update({
    where: { id: groupChat.id },
    data: { messageCount: { increment: 1 } },
  })
}

// ── Setup: User claims a group via DM ("monitor group <groupId>") ──

export async function setupGroupMonitoring(
  userId: string,
  groupId: string,
  groupName?: string,
): Promise<string> {
  const existing = await prisma.groupChat.findUnique({
    where: { userId_groupId: { userId, groupId } },
  })

  if (existing) {
    if (existing.isActive) {
      return `I'm already monitoring this group${existing.groupName ? ` (${existing.groupName})` : ''}. I'll keep learning your friends' preferences from the conversation.`
    }
    // Reactivate
    await prisma.groupChat.update({
      where: { id: existing.id },
      data: { isActive: true },
    })
    return `Reactivated monitoring for ${existing.groupName || 'this group'}!`
  }

  await prisma.groupChat.create({
    data: {
      userId,
      groupId,
      groupName: groupName || null,
    },
  })

  // Claim any unclaimed buffered messages for this group
  await prisma.groupChatMessage.updateMany({
    where: { groupId, userId: 'unclaimed' },
    data: { userId },
  })

  const claimedCount = await prisma.groupChatMessage.count({
    where: { groupId, userId },
  })

  let reply = `I'm now monitoring this group for gift preferences! Here's how it works:\n\n`
  reply += `1. I'll quietly listen to conversations in the group\n`
  reply += `2. Every time enough messages accumulate, I'll extract your friends' preferences\n`
  reply += `3. When you ask for gift ideas, I'll use what I've learned\n\n`
  reply += `I won't send any messages in the group — I just listen and learn.`

  if (claimedCount > 0) {
    reply += `\n\nI already have ${claimedCount} buffered messages from this group.`
  }

  return reply
}

// ── Stop monitoring a group ──

export async function stopGroupMonitoring(
  userId: string,
  groupId: string,
): Promise<string> {
  const existing = await prisma.groupChat.findFirst({
    where: { userId, groupId, isActive: true },
  })

  if (!existing) {
    return "I'm not monitoring this group."
  }

  await prisma.groupChat.update({
    where: { id: existing.id },
    data: { isActive: false },
  })

  return `Stopped monitoring ${existing.groupName || 'this group'}. Your friends' existing profiles are still saved.`
}

// ── List monitored groups for a user ──

export async function listMonitoredGroups(userId: string): Promise<string> {
  const groups = await prisma.groupChat.findMany({
    where: { userId, isActive: true },
  })

  if (groups.length === 0) {
    return `You're not monitoring any group chats yet.\n\nTo start: add my number to a WhatsApp group with your friends. I'll automatically listen and learn their preferences for better gift ideas.`
  }

  let reply = `*Monitored group chats:*\n`
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const name = g.groupName || `Group ${i + 1}`
    const lastExtracted = g.lastExtractedAt
      ? `last analyzed ${timeAgo(g.lastExtractedAt)}`
      : 'not yet analyzed'
    reply += `\n${i + 1}. ${name} — ${g.messageCount} messages buffered, ${lastExtracted}`
  }
  reply += `\n\nReply *extract* to analyze buffered messages now.`
  return reply
}

// ── Extract profiles from buffered group messages ──

export async function extractGroupProfiles(
  userId: string,
  groupId?: string,
): Promise<{ extracted: number; updated: string[] }> {
  const where: any = { userId, isActive: true }
  if (groupId) where.groupId = groupId

  const groups = await prisma.groupChat.findMany({ where })
  let totalExtracted = 0
  const updatedNames: string[] = []

  for (const group of groups) {
    // Skip if recently extracted and not enough new messages
    if (
      group.lastExtractedAt &&
      Date.now() - group.lastExtractedAt.getTime() < EXTRACTION_COOLDOWN_MS &&
      group.messageCount < MIN_MESSAGES_FOR_EXTRACTION
    ) {
      continue
    }

    // Get all buffered messages for this group
    const messages = await prisma.groupChatMessage.findMany({
      where: { userId, groupId: group.groupId },
      orderBy: { createdAt: 'asc' },
    })

    if (messages.length < MIN_MESSAGES_FOR_EXTRACTION) continue

    // Get the user's own phone to exclude their messages
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, name: true },
    })
    const userPhone = user?.phone ? normalizePhone(user.phone) : null

    // Group messages by sender
    const bySender = new Map<string, { name: string; messages: ParsedMessage[] }>()
    for (const msg of messages) {
      // Skip our own user's messages
      if (userPhone && msg.senderPhone === userPhone) continue
      // Skip Giftist bot messages (shouldn't be any, but just in case)
      if (msg.senderPhone === normalizePhone('15014438478')) continue

      const key = msg.senderPhone
      if (!bySender.has(key)) {
        bySender.set(key, { name: msg.senderName || msg.senderPhone, messages: [] })
      }
      bySender.get(key)!.messages.push({
        timestamp: msg.createdAt.toISOString(),
        sender: msg.senderName || msg.senderPhone,
        text: msg.content,
      })
    }

    // Extract profiles for each sender with enough messages
    for (const [senderPhone, senderData] of Array.from(bySender.entries())) {
      if (senderData.messages.length < 10) continue

      try {
        const sampled = filterAndSampleMessages(
          senderData.messages,
          senderData.name,
          2000,
        )

        // For group messages, we need to pass all messages since they're already filtered by sender
        // Override filterAndSampleMessages by passing messages directly
        const profile = await extractFriendProfile(sampled.length > 0 ? sampled : senderData.messages, senderData.name)

        // Upsert circle member
        const existing = await prisma.circleMember.findFirst({
          where: {
            userId,
            OR: [
              { phone: senderPhone },
              { name: { equals: senderData.name, mode: 'insensitive' } },
            ],
          },
        })

        if (existing) {
          // Merge with existing profile
          const existingProfile = existing.tasteProfile ? JSON.parse(existing.tasteProfile) : {}
          const merged = mergeProfileData(existingProfile, profile)

          await prisma.circleMember.update({
            where: { id: existing.id },
            data: {
              tasteProfile: JSON.stringify(merged),
              profileUpdatedAt: new Date(),
              name: senderData.name || existing.name,
            },
          })
        } else {
          await prisma.circleMember.create({
            data: {
              userId,
              phone: senderPhone,
              name: senderData.name,
              source: 'GROUP_CHAT',
              tasteProfile: JSON.stringify(profile),
              profileUpdatedAt: new Date(),
            },
          })
        }

        totalExtracted++
        updatedNames.push(senderData.name)
      } catch (err) {
        logError({
          source: 'GROUP_EXTRACT',
          message: `Failed to extract profile for ${senderData.name}: ${err}`,
        }).catch(() => {})
      }
    }

    // Update group metadata
    await prisma.groupChat.update({
      where: { id: group.id },
      data: {
        lastExtractedAt: new Date(),
        messageCount: 0, // Reset count
      },
    })

    // Clean up old buffered messages (keep last 500 per group for context)
    const keepCount = 500
    const totalMessages = await prisma.groupChatMessage.count({
      where: { userId, groupId: group.groupId },
    })
    if (totalMessages > keepCount) {
      const toDelete = await prisma.groupChatMessage.findMany({
        where: { userId, groupId: group.groupId },
        orderBy: { createdAt: 'asc' },
        take: totalMessages - keepCount,
        select: { id: true },
      })
      if (toDelete.length > 0) {
        await prisma.groupChatMessage.deleteMany({
          where: { id: { in: toDelete.map(d => d.id) } },
        })
      }
    }
  }

  return { extracted: totalExtracted, updated: updatedNames }
}

// ── Periodic extraction job (call from cron) ──

export async function runGroupExtraction(): Promise<string> {
  const activeGroups = await prisma.groupChat.findMany({
    where: {
      isActive: true,
      messageCount: { gte: MIN_MESSAGES_FOR_EXTRACTION },
    },
  })

  if (activeGroups.length === 0) {
    return 'No groups ready for extraction.'
  }

  const userIds = Array.from(new Set(activeGroups.map(g => g.userId)))
  let totalExtracted = 0
  const notifications: { userId: string; names: string[] }[] = []

  for (const userId of userIds) {
    const result = await extractGroupProfiles(userId)
    if (result.extracted > 0) {
      totalExtracted += result.extracted
      notifications.push({ userId, names: result.updated })
    }
  }

  // Notify users whose profiles were updated
  for (const n of notifications) {
    const user = await prisma.user.findUnique({
      where: { id: n.userId },
      select: { phone: true },
    })
    if (user?.phone) {
      const names = n.names.slice(0, 5).join(', ')
      const msg = `I just updated gift profiles from your group chats for: *${names}*. Ask me for gift ideas anytime!`
      sendTextMessage(user.phone, msg).catch(() => {})
    }
  }

  return `Extracted ${totalExtracted} profiles from ${activeGroups.length} groups.`
}

// ── Helpers ──

function mergeProfileData(existing: any, incoming: any): any {
  const merged = { ...existing }

  const arrayFields = ['interests', 'brands', 'wishStatements', 'dislikes', 'categories', 'favoriteStores']
  for (const field of arrayFields) {
    if (incoming[field]?.length) {
      const combined = [...(existing[field] || []), ...incoming[field]]
      const seen = new Set<string>()
      merged[field] = combined.filter((item: string) => {
        const key = item.toLowerCase().trim()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, 15)
    }
  }

  // Overwrite scalars only if incoming has something new
  if (incoming.style && incoming.style !== existing.style) {
    merged.style = incoming.style
  }
  if (incoming.pricePreference && incoming.pricePreference !== existing.pricePreference) {
    merged.pricePreference = incoming.pricePreference
  }
  if (incoming.personality && incoming.personality !== existing.personality) {
    merged.personality = incoming.personality
  }
  if (incoming.sizes) {
    merged.sizes = { ...(existing.sizes || {}), ...incoming.sizes }
  }

  return merged
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
