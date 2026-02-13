import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { createRequest } from '../../../../test/helpers'

// Mock whatsapp module
vi.mock('@/lib/whatsapp', () => ({
  normalizePhone: vi.fn((phone: string) => phone.replace(/\D/g, '')),
  sendTextMessage: vi.fn().mockResolvedValue({}),
  markAsRead: vi.fn().mockResolvedValue({}),
}))

// Mock whatsapp-handlers
vi.mock('@/lib/whatsapp-handlers', () => ({
  resolveUserAndList: vi.fn().mockResolvedValue({ userId: 'user-1', listId: 'list-1', isNewUser: false }),
  handleTextMessage: vi.fn().mockResolvedValue('Product saved!'),
  handleImageMessage: vi.fn().mockResolvedValue('Image saved!'),
  getWelcomeMessage: vi.fn().mockReturnValue('Welcome!'),
}))

import { GET, POST } from './route'
import { sendTextMessage } from '@/lib/whatsapp'
import { resolveUserAndList, handleTextMessage } from '@/lib/whatsapp-handlers'

beforeEach(() => {
  prismaMock.whatsAppMessage.findUnique.mockResolvedValue(null) // No dedup
  prismaMock.whatsAppMessage.create.mockResolvedValue({ id: 'wa-1' } as any)
  prismaMock.whatsAppMessage.update.mockResolvedValue({} as any)
  vi.mocked(resolveUserAndList).mockResolvedValue({ userId: 'user-1', listId: 'list-1', isNewUser: false })
})

describe('GET /api/webhooks/whatsapp', () => {
  it('responds to webhook verification', async () => {
    const res = await GET(createRequest(
      '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge123'
    ))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('challenge123')
  })

  it('returns 403 for invalid verify token', async () => {
    const res = await GET(createRequest(
      '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge'
    ))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/webhooks/whatsapp', () => {
  function makeWebhookBody(type: string, extra: Record<string, any> = {}) {
    return {
      entry: [{
        changes: [{
          value: {
            contacts: [{ profile: { name: 'Test User' } }],
            messages: [{
              id: 'wamid_test_123',
              from: '15551234567',
              type,
              ...extra,
            }],
          },
        }],
      }],
    }
  }

  it('processes text message', async () => {
    const body = makeWebhookBody('text', { text: { body: 'https://example.com/product' } })

    const res = await POST(createRequest('/api/webhooks/whatsapp', {
      method: 'POST',
      body,
    }))
    const data = await res.json()

    expect(data.status).toBe('ok')
    expect(handleTextMessage).toHaveBeenCalledWith(
      'user-1', 'list-1', 'https://example.com/product', '15551234567'
    )
    expect(sendTextMessage).toHaveBeenCalledWith('15551234567', 'Product saved!')
  })

  it('skips duplicate messages', async () => {
    prismaMock.whatsAppMessage.findUnique.mockResolvedValue({ id: 'existing' } as any)
    vi.mocked(handleTextMessage).mockClear()

    const body = makeWebhookBody('text', { text: { body: 'hello' } })
    const res = await POST(createRequest('/api/webhooks/whatsapp', {
      method: 'POST',
      body,
    }))

    expect(handleTextMessage).not.toHaveBeenCalled()
    expect((await res.json()).status).toBe('ok')
  })

  it('skips status updates (no messages)', async () => {
    const body = {
      entry: [{ changes: [{ value: { statuses: [{ status: 'delivered' }] } }] }],
    }

    const res = await POST(createRequest('/api/webhooks/whatsapp', {
      method: 'POST',
      body,
    }))

    expect((await res.json()).status).toBe('ok')
  })

  it('sends welcome message for new users', async () => {
    vi.mocked(resolveUserAndList).mockResolvedValue({ userId: 'user-1', listId: 'list-1', isNewUser: true })

    const body = makeWebhookBody('text', { text: { body: 'hello' } })
    await POST(createRequest('/api/webhooks/whatsapp', {
      method: 'POST',
      body,
    }))

    // Welcome message should be sent (first call), then reply (second call)
    expect(sendTextMessage).toHaveBeenCalledWith('15551234567', 'Welcome!')
  })

  it('always returns 200 even on error', async () => {
    const body = { invalid: 'structure' }

    const res = await POST(createRequest('/api/webhooks/whatsapp', {
      method: 'POST',
      body,
    }))

    expect(res.status).toBe(200)
  })
})
