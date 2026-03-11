import { getToken } from './auth'
import { BASE_URL } from './api'

interface SSECallbacks {
  onMessage: (text: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

/**
 * Manual SSE parser for React Native.
 * RN 0.76+ supports ReadableStream with New Architecture.
 * Falls back to reading full response if streaming isn't available.
 */
export async function streamChat(
  message: string,
  callbacks: SSECallbacks
): Promise<AbortController> {
  const controller = new AbortController()
  const token = await getToken()

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error || `Chat failed (${res.status})`)
    }

    if (!res.body) {
      // Fallback: read entire response
      const text = await res.text()
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            callbacks.onDone()
            return controller
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) callbacks.onMessage(parsed.text)
          } catch {}
        }
      }
      callbacks.onDone()
      return controller
    }

    // Stream via ReadableStream
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const read = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          callbacks.onDone()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              callbacks.onDone()
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) callbacks.onMessage(parsed.text)
            } catch {}
          }
        }
      }
    }

    read().catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err)
      }
    })
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      callbacks.onError(err)
    }
  }

  return controller
}
