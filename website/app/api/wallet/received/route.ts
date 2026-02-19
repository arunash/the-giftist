import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeContributionsReceived: true },
    })

    // Fetch both item-based and event-based contributions
    const [itemContributions, eventContributions] = await Promise.all([
      prisma.contribution.findMany({
        where: {
          item: { userId },
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          item: { select: { name: true, image: true } },
          contributor: { select: { name: true } },
          event: { select: { name: true } },
        },
      }),
      prisma.contribution.findMany({
        where: {
          event: { userId },
          itemId: null,
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          item: { select: { name: true, image: true } },
          contributor: { select: { name: true } },
          event: { select: { name: true } },
        },
      }),
    ])

    const allContributions = [...itemContributions, ...eventContributions]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)

    return NextResponse.json({
      lifetime: user?.lifetimeContributionsReceived || 0,
      contributions: allContributions.map((c) => ({
        id: c.id,
        amount: c.amount,
        createdAt: c.createdAt,
        itemId: c.itemId,
        eventId: c.eventId,
        itemName: c.item?.name || null,
        itemImage: c.item?.image || null,
        eventName: c.event?.name || null,
        contributorName: c.contributor?.name || null,
      })),
    })
  } catch (error) {
    console.error('Error fetching received contributions:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
