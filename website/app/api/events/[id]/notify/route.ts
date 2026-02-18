import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendTextMessage } from '@/lib/whatsapp'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const notifySchema = z.object({
  phones: z.array(z.string().min(7)).min(1).max(50),
})

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id: eventId } = params
    const body = await request.json()
    const { phones } = notifySchema.parse(body)

    // Verify ownership and get event details
    const event = await prisma.event.findFirst({
      where: { id: eventId, userId },
      include: {
        user: { select: { name: true } },
        items: {
          include: { item: { select: { name: true, price: true } } },
          orderBy: { priority: 'asc' },
          take: 3,
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Build the message
    const ownerName = event.user.name || 'Someone'
    const eventDate = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    const itemLines = event.items
      .map((ei) => {
        const price = ei.item.price ? ` — ${ei.item.price}` : ''
        return `• ${ei.item.name}${price}`
      })
      .join('\n')

    const shareUrl = `https://giftist.ai/events/${event.shareUrl}`

    let message = `🎁 ${ownerName}'s ${event.name} is coming up on ${eventDate}!`

    if (itemLines) {
      message += `\n\nHere are some gift ideas they'd love:\n${itemLines}`
    }

    message += `\n\nBrowse the full wishlist: ${shareUrl}`

    // Send to each phone with 1s delay between messages
    const results: { phone: string; success: boolean; error?: string }[] = []

    for (let i = 0; i < phones.length; i++) {
      try {
        await sendTextMessage(phones[i], message)
        results.push({ phone: phones[i], success: true })
      } catch (err) {
        results.push({ phone: phones[i], success: false, error: String(err) })
      }

      // 1s delay between messages (skip after last)
      if (i < phones.length - 1) {
        await sleep(1000)
      }
    }

    // Update event with notification timestamp
    const now = new Date()
    await prisma.event.update({
      where: { id: eventId },
      data: { circleNotifiedAt: now },
    })

    // Log activity
    createActivity({
      userId,
      type: 'CIRCLE_NOTIFIED',
      visibility: 'PRIVATE',
      metadata: {
        eventId,
        eventName: event.name,
        recipientCount: phones.length,
        successCount: results.filter((r) => r.success).length,
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      notifiedAt: now.toISOString(),
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    console.error('Error sending circle notifications:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
