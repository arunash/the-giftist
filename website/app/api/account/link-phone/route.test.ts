import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set Twilio env vars before module-level requireEnv runs (vi.hoisted runs before imports)
const mockCreate = vi.hoisted(() => {
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test_sid'
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid'
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token'
  return vi.fn()
})

import { prismaMock } from '../../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../../test/mocks/next-auth'
import { TEST_USER } from '../../../../test/helpers'
vi.mock('twilio', () => {
  return {
    default: vi.fn(() => ({
      verify: {
        v2: {
          services: vi.fn(() => ({
            verificationChecks: {
              create: mockCreate,
            },
          })),
        },
      },
    })),
  }
})

vi.mock('@/lib/whatsapp', () => ({
  normalizePhone: vi.fn((phone: string) => phone.replace(/\D/g, '')),
}))

vi.mock('@/lib/api-logger', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'

beforeEach(() => {
  setAuthenticated()
  mockCreate.mockResolvedValue({ status: 'approved' })
  prismaMock.user.findUnique.mockResolvedValue(null)
  prismaMock.user.update.mockResolvedValue({} as any)
})

describe('POST /api/account/link-phone', () => {
  it('links phone to current user', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567', code: '123456' }),
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: TEST_USER.id },
      data: { phone: '15551234567' },
    })
  })

  it('merges empty phone user into current user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'other-user',
      phone: '15551234567',
    } as any)
    prismaMock.item.count.mockResolvedValue(0)
    prismaMock.event.count.mockResolvedValue(0)
    prismaMock.chatMessage.updateMany.mockResolvedValue({ count: 0 } as any)
    prismaMock.user.delete.mockResolvedValue({} as any)

    const res = await POST(
      new Request('http://localhost:3000/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567', code: '123456' }),
      })
    )

    expect(res.status).toBe(200)
    expect(prismaMock.chatMessage.updateMany).toHaveBeenCalledWith({
      where: { userId: 'other-user' },
      data: { userId: TEST_USER.id },
    })
    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: 'other-user' },
    })
  })

  it('returns 409 when phone belongs to user with data', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'other-user',
      phone: '15551234567',
    } as any)
    prismaMock.item.count.mockResolvedValue(5)
    prismaMock.event.count.mockResolvedValue(0)

    const res = await POST(
      new Request('http://localhost:3000/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567', code: '123456' }),
      })
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBe('phone_in_use')
  })

  it('returns 400 for invalid code', async () => {
    mockCreate.mockResolvedValue({ status: 'pending' })

    const res = await POST(
      new Request('http://localhost:3000/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567', code: 'wrong' }),
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing fields', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567' }),
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await POST(
      new Request('http://localhost:3000/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567', code: '123456' }),
      })
    )
    expect(res.status).toBe(401)
  })
})
