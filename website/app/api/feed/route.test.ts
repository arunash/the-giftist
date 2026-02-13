import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../test/mocks/next-auth'
import { createRequest } from '../../../test/helpers'
import { GET } from './route'

beforeEach(() => {
  setAuthenticated()
  prismaMock.item.findMany.mockResolvedValue([])
})

describe('GET /api/feed', () => {
  it('returns items with defaults', async () => {
    prismaMock.item.findMany.mockResolvedValue([
      { id: 'item-1', name: 'Item', addedAt: new Date(), priceHistory: [] },
    ] as any)

    const res = await GET(createRequest('/api/feed'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.nextCursor).toBeNull()
  })

  it('filters unfunded items', async () => {
    await GET(createRequest('/api/feed?filter=unfunded'))

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fundedAmount: 0,
          isPurchased: false,
        }),
      })
    )
  })

  it('filters funded items', async () => {
    await GET(createRequest('/api/feed?filter=funded'))

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fundedAmount: { gt: 0 },
          isPurchased: false,
        }),
      })
    )
  })

  it('filters purchased items', async () => {
    await GET(createRequest('/api/feed?filter=purchased'))

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPurchased: true,
        }),
      })
    )
  })

  it('sorts by price high', async () => {
    await GET(createRequest('/api/feed?sort=price-high'))

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { priceValue: 'desc' },
      })
    )
  })

  it('paginates with cursor', async () => {
    const cursor = '2024-01-01T00:00:00.000Z'
    await GET(createRequest(`/api/feed?cursor=${cursor}`))

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          addedAt: { lt: new Date(cursor) },
        }),
      })
    )
  })

  it('returns nextCursor when more items exist', async () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      id: `item-${i}`,
      addedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      priceHistory: [],
    }))
    prismaMock.item.findMany.mockResolvedValue(items as any)

    const res = await GET(createRequest('/api/feed?limit=12'))
    const data = await res.json()

    expect(data.items).toHaveLength(12)
    expect(data.nextCursor).toBeTruthy()
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET(createRequest('/api/feed'))
    expect(res.status).toBe(401)
  })
})
