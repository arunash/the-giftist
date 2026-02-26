import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        createdAt: true,
        _count: {
          select: {
            items: { where: { source: { not: 'SEED' } } },
            contributions: true,
            chatMessages: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  // Compute "last active" for each user from ChatMessage + WhatsAppMessage
  const userIds = users.map(u => u.id)
  const phones = users.filter(u => u.phone).map(u => u.phone!)

  const [lastChats, lastWhatsApps] = await Promise.all([
    userIds.length > 0
      ? prisma.chatMessage.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, role: 'USER' },
          _max: { createdAt: true },
        })
      : [],
    phones.length > 0
      ? prisma.whatsAppMessage.groupBy({
          by: ['phone'],
          where: { phone: { in: phones }, type: 'INBOUND' },
          _max: { createdAt: true },
        })
      : [],
  ])

  const chatMap = new Map(lastChats.map(c => [c.userId, c._max.createdAt]))
  const waMap = new Map(lastWhatsApps.map(w => [w.phone, w._max.createdAt]))

  const enriched = users.map(u => {
    const lastChat = chatMap.get(u.id)
    const lastWa = u.phone ? waMap.get(u.phone) : null
    let lastActiveAt: Date | null = null
    let lastActiveSource: string | null = null

    if (lastChat && lastWa) {
      if (lastChat >= lastWa) {
        lastActiveAt = lastChat
        lastActiveSource = 'web'
      } else {
        lastActiveAt = lastWa
        lastActiveSource = 'whatsapp'
      }
    } else if (lastChat) {
      lastActiveAt = lastChat
      lastActiveSource = 'web'
    } else if (lastWa) {
      lastActiveAt = lastWa
      lastActiveSource = 'whatsapp'
    }

    return { ...u, lastActiveAt, lastActiveSource }
  })

  return NextResponse.json({
    users: enriched,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}
