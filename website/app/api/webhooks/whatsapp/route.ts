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
import { handleQuizMessage, startQuizForNewUser } from '@/lib/quiz-wa-handler'

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

    // Skip-stale check: if the user fired off 2+ messages in quick succession
    // (e.g., tapped 3 buttons in a row), only process the LATEST one. Avoids
    // the cascade where each rapid tap generates a parallel Claude reply.
    const newerInbound = await prisma.whatsAppMessage.findFirst({
      where: {
        phone,
        type: { in: ['text', 'interactive', 'image', 'document', 'CTWA_CLICK'] },
        id: { not: waMsg.id },
        createdAt: { gt: waMsg.createdAt },
      },
      select: { id: true },
    })
    if (newerInbound) {
      await prisma.whatsAppMessage.update({
        where: { id: waMsg.id },
        data: { status: 'SKIPPED', processedAt: new Date(), error: 'superseded by newer inbound' },
      }).catch(() => {})
      return NextResponse.json({ status: 'ok', skipped: 'stale' })
    }

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

    // === Quiz-first routing ===
    // Always check the quiz state machine BEFORE the regular welcome / Claude
    // flow. Returns handled=true if it consumed the message (button reply,
    // trigger keyword, etc.) so we exit early.
    const quizText = message.text?.body || message.caption || null
    const quizButtonId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || null
    const quizResult = await handleQuizMessage(phone, quizButtonId, quizText)
    if (quizResult.handled) {
      await prisma.whatsAppMessage.update({
        where: { id: waMsg.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      })
      return NextResponse.json({ success: true, route: 'quiz' })
    }

    // Detect if first message is a gift request (from landing page or ad ice breakers)
    // Skip the long welcome — process their request immediately
    const firstMessageText = message.text?.body || ''
    const isGiftRequest = isNewUser && messageType === 'text' && /interested in|looking at|I want|can you find|help me find|gift for|gift ideas|birthday gift|anniversary gift|who has everything|mother'?s day|father'?s day|need a gift|need gift|shopping for/i.test(firstMessageText)

    // === Quiz-first onboarding for vague new users ===
    // Replaces the old "welcome buttons" path: instead of showing 3 generic
    // gift-category buttons, kick off the 4-question quiz immediately.
    // Specific gift requests (isGiftRequest) still skip the quiz so high-
    // intent users don't get rerouted.
    if (isNewUser && !isGiftRequest) {
      await startQuizForNewUser(phone)
      sendContactMessage(phone).catch(() => {})
      await prisma.whatsAppMessage.update({
        where: { id: waMsg.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      })
      return NextResponse.json({ success: true, route: 'quiz_kickoff' })
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

        // Track "show me more" / "something else" taps — paywall after 5 free rounds (skip for admins)
        const ADMIN_PHONES = new Set(['13034087839', '14153168720', '919321918293'])
        if ((buttonId === 'satisfaction_more' || buttonId === 'satisfaction_different') && !ADMIN_PHONES.has(phone)) {
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
              await sendTextMessage(phone, `I've shown you 15+ gift ideas — you clearly have great taste! 😄\n\nOr just reply with a number from the options above to get one! 🎁`)
              await sendCtaUrlMessage(phone, 'To keep exploring, grab a Credit Pack ($5 for 50 messages):', 'Get Credit Pack — $5', sess.url || 'https://giftist.ai/settings')
              reply = ''
            } catch {
              await sendTextMessage(phone, `I've shown you 15+ gift ideas — you clearly have great taste! 😄\n\nOr just reply with a number from the options above to get one! 🎁`)
              await sendCtaUrlMessage(phone, 'To keep exploring:', 'Get Credits — $5', 'https://giftist.ai/settings')
              reply = ''
            }
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
      const replyText = alreadySent ? reply!.replace('__ALREADY_SENT__', '') : (reply || '')

      // Classify the reply
      const isProductList = !!(replyText && /\d\.\s\*[A-Z]/.test(replyText))
      const isSingleBuyLink = !!(replyText && replyText.includes('Great choice') && (replyText.includes('giftist.ai/p/') || replyText.includes('giftist.ai/r/')))

      // ONE message per turn rule:
      // - Product list → fold the satisfaction buttons into the same message body
      //   (when it fits in WhatsApp's 1024-char interactive body limit)
      // - Single buy link → fold the View & Gift CTA into the same message
      // - Anything else → plain text
      const WA_BODY_LIMIT = 1024

      if (reply && !alreadySent) {
        if (isProductList && !isSingleBuyLink && replyText.length <= WA_BODY_LIMIT) {
          await sendButtonMessage(
            phone,
            replyText,
            [
              { id: 'satisfaction_more', title: '🔄 Show me more' },
              { id: 'satisfaction_different', title: '↩️ Something else' },
              { id: 'satisfaction_yes', title: '✅ All set!' },
            ],
          ).catch(async () => {
            // Buttons can fail (e.g., body too long after WhatsApp's own counting);
            // fall back to plain text + a separate buttons follow-up.
            await sendTextMessage(phone, replyText)
            await sendButtonMessage(phone, 'What next?', [
              { id: 'satisfaction_more', title: '🔄 Show me more' },
              { id: 'satisfaction_different', title: '↩️ Something else' },
              { id: 'satisfaction_yes', title: '✅ All set!' },
            ]).catch(() => {})
          })
        } else if (isSingleBuyLink) {
          const linkMatch = replyText.match(/(https:\/\/giftist\.ai\/[pr]\/[^\s?]+)/)
          if (linkMatch && replyText.length <= WA_BODY_LIMIT) {
            await sendCtaUrlMessage(
              phone,
              replyText,
              'View & Gift Now',
              linkMatch[1],
            ).catch(async () => {
              await sendTextMessage(phone, replyText)
            })
          } else {
            await sendTextMessage(phone, replyText)
          }
        } else if (isProductList && replyText.length > WA_BODY_LIMIT) {
          // Product list too long for button body — send text + buttons separately.
          await sendTextMessage(phone, replyText)
          await sendButtonMessage(phone, 'What next?', [
            { id: 'satisfaction_more', title: '🔄 Show me more' },
            { id: 'satisfaction_different', title: '↩️ Something else' },
            { id: 'satisfaction_yes', title: '✅ All set!' },
          ]).catch(() => {})
        } else {
          await sendTextMessage(phone, replyText)
        }
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
