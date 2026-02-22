import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { notifyListViewed } from '@/lib/notifications'
import { z } from 'zod'

const viewSchema = z.object({
  shareId: z.string(),
  viewerName: z.string().max(100).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shareId, viewerName } = viewSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { shareId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ ok: true }) // silently ignore
    }

    // Debounce: max 1 notification per viewer identifier per 24h
    const viewerKey = viewerName || 'anonymous'
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: 'LIST_VIEWED',
        createdAt: { gte: cutoff },
        body: { contains: viewerKey },
      },
    })

    if (!recent) {
      await notifyListViewed(user.id, viewerKey === 'anonymous' ? 'Someone' : viewerKey)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // never fail client-side
  }
}
