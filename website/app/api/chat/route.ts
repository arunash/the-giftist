import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildChatContext, checkChatLimit } from '@/lib/chat-context'
import { parseChatContent, type EventData, type AddToEventData, type AddCircleData, type RemoveCircleData, type SendRemindersData } from '@/lib/parse-chat-content'
import { normalizePhone, sendTextMessage } from '@/lib/whatsapp'
import { createActivity } from '@/lib/activity'
import { calculateGoalAmount } from '@/lib/platform-fee'
import { enrichItem } from '@/lib/enrich-item'
import { logApiCall, logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const MAX_MESSAGE_LENGTH = 4000
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 15 // max requests per minute per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = (session.user as any).id

    // Per-request rate limit
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Please slow down.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { message } = await request.json()

    if (!message || typeof message !== 'string') {
      return new Response('Message is required', { status: 400 })
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response('Message is too long', { status: 400 })
    }

    // Check daily message limit for free users
    const { allowed, remaining } = await checkChatLimit(userId)
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'limit_reached',
          message: "You've reached your daily limit of 10 messages. Upgrade to Gold for unlimited conversations with your Gift Concierge!",
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Save user message
    await prisma.chatMessage.create({
      data: { userId, role: 'USER', content: message },
    })

    // Get recent history for conversation context
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const messages = history
      .reverse()
      .map((m) => ({
        role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }))

    // Build system prompt with user context
    const systemPrompt = await buildChatContext(userId)

    // Stream response (30s timeout to prevent hung connections)
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }, { timeout: 30000 })

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder()
    let fullContent = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text
              fullContent += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          // Save assistant response
          if (fullContent) {
            await prisma.chatMessage.create({
              data: { userId, role: 'ASSISTANT', content: fullContent },
            })

            // Process structured blocks (events, add-to-event)
            processStructuredBlocks(userId, fullContent).catch((err) => {
              console.error('Error processing chat blocks:', err)
            })
          }

          // Log after stream completes
          const finalMessage = await stream.finalMessage()
          logApiCall({
            provider: 'ANTHROPIC',
            endpoint: '/messages',
            model: 'claude-sonnet-4-5-20250929',
            inputTokens: finalMessage.usage?.input_tokens,
            outputTokens: finalMessage.usage?.output_tokens,
            userId,
            source: 'WEB',
          }).catch(() => {})

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          logError({ source: 'CHAT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in chat:', error)
    logError({ source: 'CHAT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return new Response('Internal error', { status: 500 })
  }
}

async function processStructuredBlocks(userId: string, content: string) {
  const segments = parseChatContent(content)

  for (const seg of segments) {
    if (seg.type === 'event') {
      const eventData = seg.data as EventData
      try {
        const existing = await prisma.event.findFirst({
          where: { userId, name: eventData.name },
        })
        if (!existing) {
          await prisma.event.create({
            data: {
              userId,
              name: eventData.name,
              type: eventData.type,
              date: new Date(eventData.date),
              isPublic: true,
            },
          })
        }
      } catch (err) {
        console.error('Web chat EVENT create error:', err)
      }
    }

    if (seg.type === 'add_to_event') {
      const ateData = seg.data as AddToEventData
      try {
        let itemId = ateData.itemId

        if (!itemId || itemId === 'TBD' || itemId === 'new') {
          let priceValue: number | null = null
          if (ateData.price) {
            const match = ateData.price.replace(/,/g, '').match(/[\d.]+/)
            if (match) priceValue = parseFloat(match[0])
          }

          const feeCalc = calculateGoalAmount(priceValue, 0)

          const newItem = await prisma.item.create({
            data: {
              userId,
              name: ateData.itemName,
              price: ateData.price || null,
              priceValue,
              url: `https://www.google.com/search?q=${encodeURIComponent(ateData.itemName)}`,
              domain: 'google.com',
              source: 'WEB',
              goalAmount: feeCalc.goalAmount,
            },
          })
          itemId = newItem.id

          enrichItem(itemId, ateData.itemName).catch(() => {})

          createActivity({
            userId,
            type: 'ITEM_ADDED',
            visibility: 'PUBLIC',
            itemId,
            metadata: { itemName: ateData.itemName, source: 'WEB' },
          }).catch(() => {})
        }

        let eventExists = await prisma.event.findFirst({ where: { id: ateData.eventId, userId } })
        if (!eventExists && ateData.eventName) {
          eventExists = await prisma.event.findFirst({
            where: { userId, name: { contains: ateData.eventName, mode: 'insensitive' } },
            orderBy: { date: 'asc' },
          })
        }
        if (eventExists && itemId) {
          await prisma.eventItem.deleteMany({ where: { itemId } })
          await prisma.eventItem.create({
            data: { eventId: eventExists.id, itemId, priority: 0 },
          })

          createActivity({
            userId,
            type: 'EVENT_ITEM_ADDED',
            visibility: 'PUBLIC',
            itemId,
            metadata: { itemName: ateData.itemName, eventName: eventExists.name },
          }).catch(() => {})
        }
      } catch (err) {
        console.error('Web chat ADD_TO_EVENT error:', err)
      }
    }

    if (seg.type === 'add_circle') {
      const data = seg.data as AddCircleData
      try {
        const phone = normalizePhone(data.phone)
        await prisma.circleMember.upsert({
          where: { userId_phone: { userId, phone } },
          update: {
            name: data.name ?? undefined,
            relationship: data.relationship ?? undefined,
          },
          create: {
            userId,
            phone,
            name: data.name || null,
            relationship: data.relationship || null,
            source: 'WEB',
          },
        })
      } catch (err) {
        console.error('Web chat ADD_CIRCLE error:', err)
      }
    }

    if (seg.type === 'remove_circle') {
      const data = seg.data as RemoveCircleData
      try {
        const member = await prisma.circleMember.findFirst({
          where: {
            userId,
            name: { contains: data.name, mode: 'insensitive' },
          },
        })
        if (member) {
          await prisma.circleMember.delete({ where: { id: member.id } })
        }
      } catch (err) {
        console.error('Web chat REMOVE_CIRCLE error:', err)
      }
    }

    if (seg.type === 'send_reminders') {
      const data = seg.data as SendRemindersData
      try {
        const members = await prisma.circleMember.findMany({ where: { userId } })
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, shareId: true },
        })

        if (members.length > 0 && user?.shareId) {
          const shareUrl = `https://giftist.ai/u/${user.shareId}`
          const userName = user.name || 'Your friend'
          const message = `Hi! ${userName} shared their wishlist for ${data.eventName} with you!\n\nView the list and contribute:\n${shareUrl}`

          for (const member of members) {
            sendTextMessage(member.phone, message).catch((err) => {
              console.error(`Failed to send reminder to ${member.phone}:`, err)
            })
          }
        }
      } catch (err) {
        console.error('Web chat SEND_REMINDERS error:', err)
      }
    }
  }
}
