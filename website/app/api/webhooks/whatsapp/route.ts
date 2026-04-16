import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'
import { normalizePhone, sendTextMessage, sendContactMessage, sendButtonMessage, sendImageMessage, markAsRead } from '@/lib/whatsapp'
import {
  resolveUserAndList,
  handleTextMessage,
  handleImageMessage,
  handleDocumentMessage,
  getWelcomeMessage,
} from '@/lib/whatsapp-handlers'
import { handleGroupMessage } from '@/lib/group-monitor'
import { scheduleOnboardingNudges, cancelOnboardingNudges } from '@/lib/whatsapp-funnel'
import { logError } from '@/lib/api-logger'

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    console.error('WHATSAPP_APP_SECRET not set — rejecting webhook')
    return false
  }
  if (!signature || !signature.startsWith('sha256=')) return false
  const expectedSig = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  } catch {
    return false
  }
}

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
    const rawBody = await request.text()

    // Verify webhook signature from Meta
    const signature = request.headers.get('x-hub-signature-256')
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('WhatsApp webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    // Track delivery status updates (delivered, read, failed)
    if (value?.statuses?.length > 0) {
      for (const s of value.statuses) {
        const waMessageId = s.id
        const status = s.status // 'delivered' | 'read' | 'failed'
        if (waMessageId && status) {
          prisma.whatsAppMessage.updateMany({
            where: { waMessageId },
            data: { status: status.toUpperCase() },
          }).catch(() => {})
        }
        // Log failures for debugging
        if (status === 'failed' && s.errors?.length > 0) {
          const err = s.errors[0]
          logError({
            source: 'WHATSAPP_DELIVERY',
            message: `Message ${waMessageId} failed: ${err.code} ${err.title}`,
            metadata: { phone: s.recipient_id, error: err },
          }).catch(() => {})
        }
      }
      if (!value?.messages || value.messages.length === 0) {
        return NextResponse.json({ status: 'ok' })
      }
    }

    // Skip if no messages to process
    if (!value?.messages || value.messages.length === 0) {
      return NextResponse.json({ status: 'ok' })
    }

    const message = value.messages[0]
    const contact = value.contacts?.[0]
    const waMessageId: string = message.id
    const rawPhone: string = message.from
    const messageType: string = message.type
    const profileName: string | undefined = contact?.profile?.name
    // WhatsApp Cloud API: group messages include context.group_id
    const groupId: string | undefined = message.context?.group_id || message.group_id

    const phone = normalizePhone(rawPhone)

    // Capture CTWA ad referral data (click-to-WhatsApp ads include this)
    const referral = message.referral
    const adSource = referral ? {
      source_url: referral.source_url,
      source_id: referral.source_id,
      source_type: referral.source_type,  // 'ad' for CTWA
      headline: referral.headline,
      body: referral.body,
      ctwa_clid: referral.ctwa_clid,  // Click-to-WhatsApp click ID
    } : null

    if (adSource) {
      console.log(`[WA] CTWA referral from ${phone}: ad=${adSource.source_id}, headline="${adSource.headline}"`)
    }

    // Dedup check
    const existing = await prisma.whatsAppMessage.findUnique({
      where: { waMessageId },
    })
    if (existing) {
      return NextResponse.json({ status: 'ok' })
    }

    // ── Group message: buffer and return (don't process as DM) ──
    if (groupId && messageType === 'text' && message.text?.body) {
      await prisma.whatsAppMessage.create({
        data: {
          waMessageId,
          phone,
          type: 'GROUP_MESSAGE',
          content: message.text.body,
          status: 'RECEIVED',
        },
      })

      await handleGroupMessage(
        waMessageId,
        groupId,
        rawPhone,
        profileName,
        message.text.body,
      )

      return NextResponse.json({ status: 'ok' })
    }

    // Extract content from any message type
    const messageContent = message.text?.body
      || message.caption
      || message.interactive?.button_reply?.title
      || null

    // Create audit record (include ad referral data if present)
    const waMsg = await prisma.whatsAppMessage.create({
      data: {
        waMessageId,
        phone,
        type: adSource ? 'CTWA_CLICK' : messageType,
        content: messageContent,
        status: 'RECEIVED',
        ...(adSource ? { error: JSON.stringify(adSource) } : {}),  // Store referral in error field (reuse existing column)
      },
    })

    // Mark as read
    markAsRead(waMessageId).catch(() => {})

    // Resolve user and list
    const { userId, listId, isNewUser } = await resolveUserAndList(phone, profileName)

    // New user: schedule 4h/12h/20h onboarding nudges (cancelled if they engage)
    // Returning user: cancel any pending onboarding nudges (they're back!)
    if (isNewUser) {
      scheduleOnboardingNudges(userId, phone, null).catch(() => {})
    } else {
      cancelOnboardingNudges(userId).catch(() => {})
    }

    // Detect if first message is a gift request (from landing page or ad ice breakers)
    // Skip the long welcome — process their request immediately
    const firstMessageText = message.text?.body || ''
    const isGiftRequest = isNewUser && messageType === 'text' && /interested in|looking at|I want|can you find|help me find|gift for|gift ideas|birthday gift|anniversary gift|who has everything|mother'?s day|father'?s day|need a gift|need gift|shopping for/i.test(firstMessageText)

    if (isNewUser && !isGiftRequest) {
      // Vague first message — delight them with a visual demo + interactive buttons.
      // Show what Giftist does through experience, not explanation.

      // 1. Welcome with product image (visual delight)
      await sendImageMessage(
        phone,
        'https://images.mejuri.com/images/f_auto,q_auto/at5g2jx9g1flfq84pxpa/Bold-Hoops-Gold-Plated-1-Updated.png',
        `${profileName ? `Hey ${profileName}! 👋` : 'Hey! 👋'} I'm your AI gift concierge.\n\nHere's what I found for someone shopping for Mom:\n\n✨ *Mejuri Bold Hoops* — $65\nEveryday gold hoops she'll wear with everything`,
      )

      // 2. Two more picks as text
      await sendTextMessage(phone,
        `Two more ideas at different price points:\n\n` +
        `💆 *Tatcha Dewy Skin Set* — $68\nLuxury skincare ritual she'd never buy herself\nhttps://www.tatcha.com/product/dewy-skin-set\n\n` +
        `🌿 *Le Labo Santal 33* — $220\nThe iconic scent — woody, warm, unforgettable\nhttps://www.lelabofragrances.com/santal-33-702.html`,
      )

      // 3. Interactive buttons — let them tap instead of type
      await sendButtonMessage(
        phone,
        `That was just a demo! Now tell me who *you're* shopping for — or tap a button to get started 👇`,
        [
          { id: 'gift_mom', title: '🎁 Gift for Mom' },
          { id: 'gift_birthday', title: '🎂 Birthday gift' },
          { id: 'gift_partner', title: '💝 Gift for partner' },
        ],
        undefined,
        'Free · Powered by AI',
      )

      sendContactMessage(phone).catch(() => {})

      // Mark as processed and return — don't double-process their original message
      await prisma.whatsAppMessage.update({
        where: { id: waMsg.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    if (isNewUser && isGiftRequest) {
      sendContactMessage(phone).catch(() => {})
      // After the AI reply is sent (below), send a follow-up nudge to keep the conversation going
      setTimeout(() => {
        sendTextMessage(phone, `💡 *Quick tip:* Reply with more details (hobbies, budget, age) and I'll refine my picks. Or just say "more like #1" to see similar options!`).catch(() => {})
      }, 8000)  // 8 second delay so it arrives after the product images + text
    }

    let reply = ''
    let itemId: string | undefined

    // Map interactive button replies to text messages
    const buttonReplyMap: Record<string, string> = {
      'gift_mom': "Gift ideas for my mom",
      'gift_birthday': "I need a birthday gift",
      'gift_partner': "Gift ideas for my partner",
    }

    try {
      if (messageType === 'interactive') {
        // Handle button reply — translate to text and process through Claude
        const buttonId = message.interactive?.button_reply?.id || ''
        const mappedText = buttonReplyMap[buttonId] || message.interactive?.button_reply?.title || 'gift ideas'
        reply = await handleTextMessage(userId, listId, mappedText, phone)
      } else if (messageType === 'text') {
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
      } else if (messageType === 'document') {
        const doc = message.document
        reply = await handleDocumentMessage(
          userId,
          listId,
          doc.id,
          doc.mime_type,
          doc.filename,
          phone,
        )
      } else {
        reply = "I can process links, photos, and WhatsApp chat exports (.txt). Send me a product URL, image, or exported chat!"
      }

      // Send reply (empty string means handler already sent a reply)
      if (reply) {
        await sendTextMessage(phone, reply)
      }

      // For product-specific first messages, DON'T mention credits yet — let them experience the value first.
      // Credits info is shown after their 3rd message via the existing credit check logic.

      // Update audit record
      await prisma.whatsAppMessage.update({
        where: { id: waMsg.id },
        data: { status: 'PROCESSED', processedAt: new Date(), itemId },
      })
    } catch (processingError) {
      console.error('WhatsApp processing error:', processingError)
      logError({ source: 'WHATSAPP_WEBHOOK', message: String(processingError), stack: (processingError as Error)?.stack }).catch(() => {})

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
    logError({ source: 'WHATSAPP_WEBHOOK', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
  }

  // Always return 200 to prevent Meta retries
  return NextResponse.json({ status: 'ok' })
}
