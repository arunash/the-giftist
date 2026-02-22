import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../test/mocks/next-auth'
import { createRequest } from '../../../test/helpers'
import { GET, PATCH } from './route'

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/profile', () => {
  it('returns user profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Test User',
      email: 'test@example.com',
      phone: '15551234567',
      birthday: null,
      gender: 'MALE',
      ageRange: '25-34',
      interests: JSON.stringify(['tech', 'gaming']),
      giftBudget: '100_250',
      relationship: 'SINGLE',
      accounts: [{ provider: 'google' }],
    } as any)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.name).toBe('Test User')
    expect(data.interests).toEqual(['tech', 'gaming'])
  })

  it('returns empty interests array when null', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Test',
      interests: null,
      accounts: [],
    } as any)

    const res = await GET()
    const data = await res.json()

    expect(data.interests).toEqual([])
  })

  it('returns 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/profile', () => {
  it('updates profile fields', async () => {
    prismaMock.user.update.mockResolvedValue({
      birthday: null,
      gender: 'FEMALE',
      ageRange: '25-34',
      interests: JSON.stringify(['cooking']),
      giftBudget: '50_100',
      relationship: 'COUPLE',
    } as any)

    const res = await PATCH(createRequest('/api/profile', {
      method: 'PATCH',
      body: {
        gender: 'FEMALE',
        interests: ['cooking'],
        giftBudget: '50_100',
        relationship: 'COUPLE',
      },
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.gender).toBe('FEMALE')
    expect(data.interests).toEqual(['cooking'])
  })

  it('returns 400 for invalid gender', async () => {
    const res = await PATCH(createRequest('/api/profile', {
      method: 'PATCH',
      body: { gender: 'INVALID' },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid budget', async () => {
    const res = await PATCH(createRequest('/api/profile', {
      method: 'PATCH',
      body: { giftBudget: 'MILLION' },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await PATCH(createRequest('/api/profile', {
      method: 'PATCH',
      body: { gender: 'MALE' },
    }))
    expect(res.status).toBe(401)
  })
})
