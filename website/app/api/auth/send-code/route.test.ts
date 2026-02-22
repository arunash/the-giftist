import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted runs before vi.mock and imports, so env vars are available
// when the route module loads at import time.
const mockCreate = vi.hoisted(() => {
  // Set Twilio env vars before the route module is evaluated
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid'
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token'
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test_verify_sid'

  return vi.fn().mockResolvedValue({ sid: 'VE_test' })
})

// Mock twilio SDK
vi.mock('twilio', () => {
  return {
    default: () => ({
      verify: {
        v2: {
          services: () => ({
            verifications: {
              create: mockCreate,
            },
          }),
        },
      },
    }),
  }
})

// Mock whatsapp module (normalizePhone is still used by the route)
vi.mock('@/lib/whatsapp', () => ({
  normalizePhone: vi.fn((phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) return '1' + digits
    return digits
  }),
}))

// Mock api-logger to avoid side effects
vi.mock('@/lib/api-logger', () => ({
  logApiCall: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'

function makeRequest(body: object, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/send-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `${Math.random()}`, // unique IP per request to avoid rate limiting across tests
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue({ sid: 'VE_test' })
})

describe('POST /api/auth/send-code', () => {
  it('sends verification code', async () => {
    const res = await POST(makeRequest({ phone: '15551234567' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith({
      to: '+15551234567',
      channel: 'whatsapp',
    })
  })

  it('returns 400 for missing phone', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 for short phone number', async () => {
    const res = await POST(makeRequest({ phone: '12345' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    // Use a fixed IP and phone so the rate limiter accumulates counts
    const fixedIp = '192.168.1.100'
    const phone = '15559999999'

    // Exhaust the per-phone limit (MAX_PER_PHONE = 5)
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        new NextRequest('http://localhost:3000/api/auth/send-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': fixedIp,
          },
          body: JSON.stringify({ phone }),
        })
      )
      expect(res.status).toBe(200)
    }

    // 6th request should be rate limited
    const res = await POST(
      new NextRequest('http://localhost:3000/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': fixedIp,
        },
        body: JSON.stringify({ phone }),
      })
    )
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain('Too many requests')
  })
})
