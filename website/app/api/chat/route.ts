import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildChatContext } from '@/lib/chat-context'
import { logApiCall, logError } from '@/lib/api-logger'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = (session.user as any).id
    const { message } = await request.json()

    if (!message || typeof message !== 'string') {
      return new Response('Message is required', { status: 400 })
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
