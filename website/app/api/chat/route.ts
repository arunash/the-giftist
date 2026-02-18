import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildChatContext, checkChatLimit } from '@/lib/chat-context'
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

    // Stream response
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

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
