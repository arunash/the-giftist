import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = params

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      accounts: {
        select: { provider: true, providerAccountId: true },
      },
      subscription: true,
      wallet: {
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const [
    items,
    events,
    chatMessages,
    circleMembers,
    contributionsReceived,
    activityEvents,
    whatsAppMessages,
  ] = await Promise.all([
    prisma.item.findMany({
      where: { userId: id },
      orderBy: { addedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        price: true,
        priceValue: true,
        image: true,
        url: true,
        domain: true,
        category: true,
        source: true,
        addedAt: true,
        goalAmount: true,
        fundedAmount: true,
        isPurchased: true,
      },
    }),
    prisma.event.findMany({
      where: { userId: id },
      orderBy: { date: 'asc' },
      include: {
        _count: { select: { items: true, contributions: true } },
      },
    }),
    prisma.chatMessage.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.circleMember.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contribution.findMany({
      where: { item: { userId: id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        message: true,
        status: true,
        isAnonymous: true,
        contributorEmail: true,
        createdAt: true,
        item: { select: { name: true } },
      },
    }),
    prisma.activityEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    user.phone
      ? prisma.whatsAppMessage.findMany({
          where: { phone: user.phone },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : [],
  ])

  // Compute stats
  const itemsBySource: Record<string, number> = {}
  items.forEach((item) => {
    itemsBySource[item.source] = (itemsBySource[item.source] || 0) + 1
  })

  const totalItems = await prisma.item.count({ where: { userId: id } })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayChatCount = chatMessages.filter(
    (m) => new Date(m.createdAt) >= todayStart
  ).length

  const todayWhatsAppCount = Array.isArray(whatsAppMessages)
    ? whatsAppMessages.filter((m) => new Date(m.createdAt) >= todayStart).length
    : 0

  // Last active: most recent chat or WhatsApp message
  const lastChatDate = chatMessages[0]?.createdAt
  const lastWhatsAppDate = Array.isArray(whatsAppMessages)
    ? whatsAppMessages[0]?.createdAt
    : null
  const lastActive = [lastChatDate, lastWhatsAppDate]
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null

  return NextResponse.json({
    user,
    items,
    totalItems,
    itemsBySource,
    events,
    chatMessages,
    todayChatCount,
    whatsAppMessages,
    todayWhatsAppCount,
    circleMembers,
    contributionsReceived,
    activityEvents,
    lastActive,
  })
}
