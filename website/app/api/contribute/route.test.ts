import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../test/mocks/next-auth'
import { stripeMock } from '../../../test/mocks/stripe'
import { createRequest, TEST_USER } from '../../../test/helpers'
import { GET, POST } from './route'

vi.mock('@/lib/api-logger', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logApiCall: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  setAuthenticated()
  prismaMock.activityEvent.create.mockResolvedValue({} as any)
  stripeMock.checkout.sessions.create.mockResolvedValue({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/test',
  })
})

describe('POST /api/contribute', () => {
  it('creates a contribution', async () => {
    prismaMock.item.findUnique.mockResolvedValue({
      id: 'item-1',
      userId: 'owner-1',
      isPurchased: false,
      fundedAmount: 0,
      goalAmount: 100,
      priceValue: 100,
      name: 'Gift',
    } as any)
    prismaMock.contribution.create.mockResolvedValue({
      id: 'contrib-1',
      amount: 25,
    } as any)
    prismaMock.item.update.mockResolvedValue({} as any)

    const res = await POST(createRequest('/api/contribute', {
      method: 'POST',
      body: { itemId: 'item-1', amount: 25 },
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.url).toBe('https://checkout.stripe.com/test')
  })

  it('returns 404 for non-existent item', async () => {
    prismaMock.item.findUnique.mockResolvedValue(null)

    const res = await POST(createRequest('/api/contribute', {
      method: 'POST',
      body: { itemId: 'nonexistent', amount: 10 },
    }))
    expect(res.status).toBe(404)
  })

  it('returns 400 for already purchased item', async () => {
    prismaMock.item.findUnique.mockResolvedValue({
      id: 'item-1',
      isPurchased: true,
      fundedAmount: 100,
      goalAmount: 100,
    } as any)

    const res = await POST(createRequest('/api/contribute', {
      method: 'POST',
      body: { itemId: 'item-1', amount: 10 },
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('purchased')
  })

  it('returns 400 when contribution exceeds remaining', async () => {
    prismaMock.item.findUnique.mockResolvedValue({
      id: 'item-1',
      isPurchased: false,
      fundedAmount: 90,
      goalAmount: 100,
      priceValue: 100,
    } as any)

    const res = await POST(createRequest('/api/contribute', {
      method: 'POST',
      body: { itemId: 'item-1', amount: 20 },
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Maximum')
  })

  it('returns 400 for invalid data', async () => {
    const res = await POST(createRequest('/api/contribute', {
      method: 'POST',
      body: { itemId: 'item-1', amount: -5 },
    }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/contribute', () => {
  it('returns contributions for an item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({ id: 'item-1', userId: TEST_USER.id } as any)
    prismaMock.contribution.findMany.mockResolvedValue([
      { id: 'c-1', amount: 25, contributor: { name: 'Friend' } },
    ] as any)

    const res = await GET(createRequest('/api/contribute?itemId=item-1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(1)
  })

  it('returns 400 when itemId missing', async () => {
    const res = await GET(createRequest('/api/contribute'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not owned', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null)

    const res = await GET(createRequest('/api/contribute?itemId=item-1'))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET(createRequest('/api/contribute?itemId=item-1'))
    expect(res.status).toBe(401)
  })
})
