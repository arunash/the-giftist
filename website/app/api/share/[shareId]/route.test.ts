import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { createRequest } from '../../../../test/helpers'
import { GET } from './route'

// No auth mock needed — this is a public endpoint

const params = { params: { shareId: 'abc12345' } }

describe('GET /api/share/[shareId]', () => {
  it('returns shared wishlist', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Jane',
      shareId: 'abc12345',
      items: [
        {
          id: 'item-1',
          name: 'Gift Idea',
          price: '$25.00',
          priceValue: 25,
          image: null,
          url: 'https://example.com',
          domain: 'example.com',
          category: 'Gifts',
          fundedAmount: 10,
          goalAmount: 25,
          isPurchased: false,
          priceHistory: [{ price: 25, recordedAt: new Date('2024-01-01') }],
        },
      ],
    } as any)

    const res = await GET(createRequest('/api/share/abc12345'), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ownerName).toBe('Jane')
    expect(data.items).toHaveLength(1)
    expect(data.items[0].name).toBe('Gift Idea')
    expect(data.categories).toContain('Gifts')
  })

  it('returns 404 for unknown shareId', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await GET(createRequest('/api/share/nonexistent'), params)
    expect(res.status).toBe(404)
  })

  it('returns "Someone" when user has no name', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: null,
      items: [],
    } as any)

    const res = await GET(createRequest('/api/share/abc12345'), params)
    const data = await res.json()

    expect(data.ownerName).toBe('Someone')
  })
})
