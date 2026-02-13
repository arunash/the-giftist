import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizePhone, sendTextMessage, markAsRead } from '@/lib/whatsapp'
import {
  resolveUserAndList,
  handleTextMessage,
  handleImageMessage,
  getWelcomeMessage,
} from '@/lib/whatsapp-handlers'

// Meta webhook verification
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Message processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    // Skip delivery status updates
    if (!value?.messages || value.messages.length === 0) {
      return NextResponse.json({ status: 'ok' })
    }

    const message = value.messages[0]
    const contact = value.contacts?.[0]
    const waMessageId: string = message.id
    const rawPhone: string = message.from
    const messageType: string = message.type
    const profileName: string | undefined = contact?.profile?.name

    const phone = normalizePhone(rawPhone)

    // Dedup check
    const existing = await prisma.whatsAppMessage.findUnique({
      where: { waMessageId },
    })
    if (existing) {
      return NextResponse.json({ status: 'ok' })
    }

    // Create audit record
    const waMsg = await prisma.whatsAppMessage.create({
      data: {
        waMessageId,
        phone,
        type: messageType,
        content: message.text?.body || message.caption || null,
        status: 'RECEIVED',
      },
    })

    // Mark as read
    markAsRead(waMessageId).catch(() => {})

    // Resolve user and list
    const { userId, listId, isNewUser } = await resolveUserAndList(phone, profileName)

    if (isNewUser) {
      await sendTextMessage(phone, getWelcomeMessage(profileName))
    }

    let reply = ''
    let itemId: string | undefined

    try {
      if (messageType === 'text') {
        reply = await handleTextMessage(userId, listId, message.text.body, phone)
      } else if (messageType === 'image') {
        const media = message.image
        reply = await handleImageMessage(
          userId,
          listId,
          media.id,
          media.mime_type,
          media.caption,
          phone,
        )
      } else {
        reply = "I can process links and photos. Send me a product URL or image!"
      }

      // Send reply (empty string means handler already sent a reply)
      if (reply) {
        await sendTextMessage(phone, reply)
      }

      // Update audit record
      await prisma.whatsAppMessage.update({
        where: { id: waMsg.id },
        data: { status: 'PROCESSED', processedAt: new Date(), itemId },
      })
    } catch (processingError) {
      console.error('WhatsApp processing error:', processingError)

      await prisma.whatsAppMessage.update({
        where: { id: waMsg.id },
        data: {
          status: 'FAILED',
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
          processedAt: new Date(),
        },
      })

      try {
        await sendTextMessage(phone, "Something went wrong processing your message. Please try again.")
      } catch {
        // Can't even send error reply — just log
      }
    }
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
  }

  // Always return 200 to prevent Meta retries
  return NextResponse.json({ status: 'ok' })
}
