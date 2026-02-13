import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../../test/mocks/next-auth'
import { TEST_USER } from '../../../../test/helpers'

// Mock verification-codes and whatsapp before importing route
vi.mock('@/lib/verification-codes', () => ({
  verifyCode: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/whatsapp', () => ({
  normalizePhone: vi.fn((phone: string) => phone.replace(/\D/g, '')),
}))

vi.mock('@/lib/merge-users', () => ({
  mergeUsers: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'
import { verifyCode } from '@/lib/verification-codes'
import { mergeUsers } from '@/lib/merge-users'

beforeEach(() => {
  setAuthenticated()
  vi.mocked(verifyCode).mockReturnValue(true)
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

  it('merges users when phone belongs to another user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'other-user',
      phone: '15551234567',
    } as any)

    await POST(
      new Request('http://localhost:3000/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '15551234567', code: '123456' }),
      })
    )

    expect(mergeUsers).toHaveBeenCalledWith('other-user', TEST_USER.id)
  })

  it('returns 400 for invalid code', async () => {
    vi.mocked(verifyCode).mockReturnValue(false)

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
