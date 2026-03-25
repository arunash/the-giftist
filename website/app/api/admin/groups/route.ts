import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalGroups,
    activeGroups,
    totalBufferedMessages,
    messagesToday,
    messagesWeek,
    groupChats,
    totalExtractions,
    profilesWithSource,
    recentMessages,
  ] = await Promise.all([
    prisma.groupChat.count(),
    prisma.groupChat.count({ where: { isActive: true } }),
    prisma.groupChatMessage.count(),
    prisma.groupChatMessage.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.groupChatMessage.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.groupChat.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.groupChat.count({ where: { lastExtractedAt: { not: null } } }),
    prisma.circleMember.count({ where: { source: 'GROUP_CHAT' } }),
    prisma.groupChatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        groupId: true,
        senderPhone: true,
        senderName: true,
        content: true,
        createdAt: true,
        userId: true,
      },
    }),
  ])

  // Enrich groups with user info and message counts
  const userIds = [...new Set(groupChats.map(g => g.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, phone: true, email: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  // Get per-group message counts
  const groupIds = groupChats.map(g => g.groupId)
  const messageCounts = await prisma.groupChatMessage.groupBy({
    by: ['groupId'],
    _count: { id: true },
    where: { groupId: { in: groupIds } },
  })
  const messageCountMap = new Map(messageCounts.map(m => [m.groupId, m._count.id]))

  // Get unique senders per group
  const senderCounts = await prisma.groupChatMessage.groupBy({
    by: ['groupId', 'senderPhone'],
    where: { groupId: { in: groupIds } },
  })
  const senderCountMap = new Map<string, number>()
  for (const s of senderCounts) {
    senderCountMap.set(s.groupId, (senderCountMap.get(s.groupId) || 0) + 1)
  }

  const enrichedGroups = groupChats.map(g => {
    const user = userMap.get(g.userId)
    return {
      ...g,
      userName: user?.name || user?.phone || user?.email || g.userId,
      totalMessages: messageCountMap.get(g.groupId) || 0,
      uniqueSenders: senderCountMap.get(g.groupId) || 0,
    }
  })

  return NextResponse.json({
    stats: {
      totalGroups,
      activeGroups,
      totalBufferedMessages,
      messagesToday,
      messagesWeek,
      totalExtractions,
      profilesFromGroups: profilesWithSource,
    },
    groups: enrichedGroups,
    recentMessages,
  })
}
