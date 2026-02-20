import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { sendTemplateMessage } from '@/lib/whatsapp'
import { logError } from '@/lib/api-logger'
import { z } from 'zod'

const thankYouSchema = z.object({
  contributionId: z.string(),
  message: z.string().min(1).max(500),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const data = thankYouSchema.parse(body)

    const contribution = await prisma.contribution.findUnique({
      where: { id: data.contributionId },
      include: {
        item: { select: { userId: true, name: true } },
        event: { select: { userId: true, name: true } },
        contributor: { select: { phone: true, name: true } },
      },
    })

    if (!contribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
    }

    // Validate giftee owns the item or event
    const ownerId = contribution.item?.userId || contribution.event?.userId
    if (ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (contribution.thankYouSentAt) {
      return NextResponse.json({ error: 'Thank-you already sent' }, { status: 400 })
    }

    // Update contribution with thank-you
    await prisma.contribution.update({
      where: { id: data.contributionId },
      data: {
        thankYouMessage: data.message,
        thankYouSentAt: new Date(),
      },
    })

    // Create activity
    const giftName = contribution.item?.name || contribution.event?.name || 'a gift'
    await createActivity({
      userId,
      type: 'THANK_YOU_SENT',
      visibility: 'PRIVATE',
      itemId: contribution.itemId || undefined,
      metadata: {
        contributionId: contribution.id,
        giftName,
        message: data.message,
      },
    })

    // Send WhatsApp to contributor if they have a phone (template: thank_you_note)
    // Body: "Hi! {{1}} sent you a thank-you for your contribution: {{2}}. You can visit http://giftist.ai to view the note"
    if (contribution.contributor?.phone) {
      const giftee = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      })
      const gifteeName = giftee?.name || 'Someone'
      sendTemplateMessage(
        contribution.contributor.phone,
        'thank_you_note',
        [gifteeName, data.message]
      ).catch((err) => console.error('Thank-you WhatsApp failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    console.error('Error sending thank-you:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to send thank-you' }, { status: 500 })
  }
}
