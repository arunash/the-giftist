import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'
import { normalizePhone, sendTextMessage, sendContactMessage, sendButtonMessage, sendImageMessage, sendVideoMessage, sendReaction, sendListMessage, sendCtaUrlMessage, markAsRead } from '@/lib/whatsapp'
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

    // Mark as read + react immediately so user sees we're working on it
    markAsRead(waMessageId).catch(() => {})
    if (messageType === 'text' || messageType === 'interactive') {
      sendReaction(phone, waMessageId, '🎁').catch(() => {})
    }

    // Resolve user and list
    const { userId, listId, isNewUser } = await resolveUserAndList(phone, profileName)

    // New user: schedule 4h/12h/20h onboarding nudges
    // Returning user: cancel nudges ONLY if they come back after being away (not during same session)
    if (isNewUser) {
      scheduleOnboardingNudges(userId, phone, null).catch(() => {})
    } else {
      // Check if user's previous message was > 1 hour ago (they left and came back)
      const prevMsg = await prisma.whatsAppMessage.findFirst({
        where: { phone, type: { in: ['text', 'interactive', 'CTWA_CLICK'] } },
        orderBy: { createdAt: 'desc' },
        skip: 1, // skip the current message
      })
      const hoursSinceLast = prevMsg ? (Date.now() - new Date(prevMsg.createdAt).getTime()) / 3600000 : 0
      if (hoursSinceLast > 1) {
        cancelOnboardingNudges(userId).catch(() => {})
      }
    }

    // Detect if first message is a gift request (from landing page or ad ice breakers)
    // Skip the long welcome — process their request immediately
    const firstMessageText = message.text?.body || ''
    const isGiftRequest = isNewUser && messageType === 'text' && /interested in|looking at|I want|can you find|help me find|gift for|gift ideas|birthday gift|anniversary gift|who has everything|mother'?s day|father'?s day|need a gift|need gift|shopping for/i.test(firstMessageText)

    if (isNewUser && !isGiftRequest) {
      // Vague first message — detect language, send welcome + buttons.
      const isSpanish = /hola|información|quiero|regalo|busco|ayuda/i.test(firstMessageText)

      if (isSpanish) {
        await sendButtonMessage(
          phone,
          `${profileName ? `¡Hola ${profileName}! 👋` : '¡Hola! 👋'} Encuentro el regalo perfecto para cualquier persona en segundos.\n\nDime *para quién es* y *qué le gusta* — te envío 3 opciones con precios y links.\n\nO toca un botón para empezar:`,
          [
            { id: 'list_mom', title: '🌸 Regalo para Mamá' },
            { id: 'list_birthday', title: '🎂 Regalo cumpleaños' },
            { id: 'list_partner', title: '💝 Regalo pareja' },
          ],
          undefined,
          'Gratis · Respuesta en segundos',
        )
      } else {
        await sendButtonMessage(
          phone,
          `${profileName ? `Hey ${profileName}! 👋` : 'Hey! 👋'} I find the perfect gift for anyone in seconds.\n\nJust tell me *who it's for* and *what they're into* — I'll send you 3 great options with prices and links.\n\nOr tap below to get started:`,
          [
            { id: 'list_mom', title: '🌸 Gift for Mom' },
            { id: 'list_birthday', title: '🎂 Birthday gift' },
            { id: 'list_partner', title: '💝 Gift for partner' },
          ],
          undefined,
          'Free · Reply in seconds',
        )
      }

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
      // Nudge is sent after the reply below (can't setTimeout on serverless)
    }

    let reply = ''
    let itemId: string | undefined

    // Map interactive button + list replies to text messages
    const buttonReplyMap: Record<string, string> = {
      // Welcome buttons
      'gift_mom': "Gift ideas for my mom",
      'gift_birthday': "I need a birthday gift",
      'gift_partner': "Gift ideas for my partner",
      // Satisfaction buttons
      'satisfaction_yes': "Thanks, I found what I needed!",
      'satisfaction_more': "Show me more options",
      'satisfaction_different': "I want something completely different",
      // Occasion list items
      'list_mom': "Gift ideas for my mom for Mother's Day",
      'list_birthday': "I need a birthday gift",
      'list_partner': "Gift for my partner for our anniversary",
      'list_wedding': "Wedding gift for a couple",
      'list_baby': "Gift for a baby shower",
      'list_graduation': "Graduation gift",
      'list_thankyou': "Thank you gift for a host",
      'list_selfcare': "I want to treat myself — what do you recommend?",
    }

    try {
      if (messageType === 'interactive') {
        // Handle button replies, list replies
        const buttonId = message.interactive?.button_reply?.id
          || message.interactive?.list_reply?.id
          || ''

        // Track "show me more" / "something else" taps — paywall after 2 free rounds
        if (buttonId === 'satisfaction_more' || buttonId === 'satisfaction_different') {
          const browseCount = await prisma.whatsAppMessage.count({
            where: {
              phone,
              type: 'interactive',
              content: { in: ['Show me more', 'Something else', '🔄 Show me more', '↩️ Something else'] },
            },
          })

          if (browseCount >= 5) {
            // 6th+ browse — soft paywall with option to pick from what they've seen
            try {
              const { stripe } = await import('@/lib/stripe')
              let sub = await prisma.subscription.findUnique({ where: { userId } })
              let custId = sub?.stripeCustomerId
              if (!custId) {
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
                const cust = await stripe.customers.create({ email: user?.email || undefined, metadata: { userId } })
                custId = cust.id
                if (sub) await prisma.subscription.update({ where: { userId }, data: { stripeCustomerId: custId } })
                else await prisma.subscription.create({ data: { userId, stripeCustomerId: custId, status: 'INACTIVE' } })
              }
              const sess = await stripe.checkout.sessions.create({
                mode: 'payment',
                customer: custId,
                line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Giftist Credit Pack', description: '50 messages + 5 Gift DNA analyses' }, unit_amount: 500 }, quantity: 1 }],
                metadata: { type: 'credit_pack', userId },
                success_url: 'https://giftist.ai/settings?credits=success',
                cancel_url: 'https://giftist.ai',
              })
              reply = `I've shown you 15+ gift ideas — you clearly have great taste! 😄\n\nTo keep exploring, grab a *Credit Pack* ($5 for 50 messages):\n${sess.url}\n\nOr just reply with a number from the options above to get one of those! 🎁`
            } catch {
              reply = `I've shown you 15+ gift ideas — you clearly have great taste! 😄\n\nTo keep exploring, grab a *Credit Pack* ($5 for 50 messages) or go *Gold* ($4.99/mo) for unlimited → giftist.ai/settings\n\nOr just reply with a number from the options above to get one! 🎁`
            }

            if (reply) await sendTextMessage(phone, reply)
            await prisma.whatsAppMessage.update({ where: { id: waMsg.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
            return NextResponse.json({ success: true })
          }
        }

        // "All set!" — celebrate with a GIF (sent as MP4 video — WhatsApp doesn't support .gif)
        if (buttonId === 'satisfaction_yes') {
          const memes = [
            { url: 'https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.mp4', caption: "Congratulations! 🎉" },
            { url: 'https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy.mp4', caption: "Nailed it! 👏" },
            { url: 'https://media.giphy.com/media/3oEjI5VtIhHvK37WYo/giphy.mp4', caption: "Great job! 🎯" },
            { url: 'https://media.giphy.com/media/fdyZ3qI0GVZC0/giphy.mp4', caption: "Mission accomplished! 🚀" },
            { url: 'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.mp4', caption: "That's what I like to hear! 🎁" },
          ]
          const meme = memes[Math.floor(Math.random() * memes.length)]
          sendVideoMessage(phone, meme.url, meme.caption).catch(() => {})
          reply = "I'm here whenever you need gift ideas again — just text me anytime! 🎁"
        } else {
          // Buttons + list items → translate to text and process through Claude
          const mappedText = buttonReplyMap[buttonId]
            || message.interactive?.button_reply?.title
            || message.interactive?.list_reply?.title
            || 'gift ideas'
          reply = await handleTextMessage(userId, listId, mappedText, phone)
        }
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
      } else if (messageType === 'audio') {
        // Voice note support — transcribe with Whisper, then process as text
        const audioId = message.audio?.id
        if (audioId) {
          try {
            const { downloadMedia } = await import('@/lib/whatsapp')
            const audioBuffer = await downloadMedia(audioId)

            // Transcribe with OpenAI Whisper
            const OpenAI = (await import('openai')).default
            const { writeFileSync, unlinkSync, createReadStream } = await import('fs')
            const tmpPath = `/tmp/voice_${Date.now()}.ogg`
            writeFileSync(tmpPath, audioBuffer)
            const openai = new OpenAI()
            const transcription = await openai.audio.transcriptions.create({
              file: createReadStream(tmpPath) as any,
              model: 'whisper-1',
            })
            unlinkSync(tmpPath)

            const text = transcription.text
            if (text) {
              await sendTextMessage(phone, `🎤 I heard: _"${text}"_`)
              reply = await handleTextMessage(userId, listId, text, phone)
            } else {
              reply = "I couldn't catch that — could you try typing your request instead?"
            }
          } catch (err) {
            console.error('Voice note error:', err)
            reply = "I couldn't process that voice note — try typing your request or sending it as text!"
          }
        }
      } else {
        reply = "I can help with gifts! Just type who you're shopping for, send a photo, or use a voice note 🎤"
      }

      // Send reply — skip if handler already sent it (marked with __ALREADY_SENT__)
      const alreadySent = reply?.startsWith('__ALREADY_SENT__')
      if (reply && !alreadySent) {
        await sendTextMessage(phone, reply)
      }
      const replyText = alreadySent ? reply!.replace('__ALREADY_SENT__', '') : (reply || '')

      // Send satisfaction buttons after product RECOMMENDATIONS (multiple products, not single buy links)
      const isProductList = replyText && /\d\.\s\*[A-Z]/.test(replyText)
      const isSingleBuyLink = replyText && replyText.includes('Great choice') && replyText.includes('giftist.ai/p/')

      if (isProductList && !isSingleBuyLink) {
        await sendButtonMessage(
          phone,
          'Reply 1, 2, or 3 to get it!',
          [
            { id: 'satisfaction_more', title: '🔄 Show me more' },
            { id: 'satisfaction_different', title: '↩️ Something else' },
            { id: 'satisfaction_yes', title: '✅ All set!' },
          ],
        ).catch(() => {})
      }

      // When user picks a product ("Great choice!"), send a big CTA button for the buy link
      if (isSingleBuyLink) {
        const linkMatch = replyText.match(/(https:\/\/giftist\.ai\/p\/[^\s?]+)/)
        if (linkMatch) {
          await sendCtaUrlMessage(
            phone,
            '👆 Tap to see it & grab it before it sells out!',
            'View & Gift Now',
            linkMatch[1],
          ).catch(() => {})
        }
      }

      // First gift request nudge — for new users only
      if (isNewUser && isGiftRequest && reply) {
        await sendTextMessage(phone, `💡 *Quick tip:* Reply with more details (hobbies, budget, age) and I'll refine my picks. Or just say "more like #1" to see similar options!`).catch(() => {})
      }

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
