import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequest } from '../../../../test/helpers'

// Mock whatsapp module
vi.mock('@/lib/whatsapp', () => ({
  normalizePhone: vi.fn((phone: string) => phone.replace(/\D/g, '')),
  sendTextMessage: vi.fn().mockResolvedValue({}),
}))

// Mock verification-codes module
vi.mock('@/lib/verification-codes', () => ({
  generateCode: vi.fn().mockReturnValue({ code: '123456' }),
}))

import { POST } from './route'
import { generateCode } from '@/lib/verification-codes'
import { sendTextMessage } from '@/lib/whatsapp'

beforeEach(() => {
  vi.mocked(generateCode).mockReturnValue({ code: '123456' })
  vi.mocked(sendTextMessage).mockResolvedValue({})
})

describe('POST /api/auth/send-code', () => {
  it('sends verification code', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567' }),
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(sendTextMessage).toHaveBeenCalled()
  })

  it('returns 400 for missing phone', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for short phone number', async () => {
    vi.mocked(generateCode).mockReturnValue({ code: '123456' })

    const res = await POST(
      new Request('http://localhost:3000/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '12345' }),
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(generateCode).mockReturnValue({ error: 'Please wait 60 seconds before requesting a new code' })

    const res = await POST(
      new Request('http://localhost:3000/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567' }),
      })
    )
    expect(res.status).toBe(429)
  })
})
