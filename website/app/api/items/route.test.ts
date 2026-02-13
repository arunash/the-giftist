import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../test/mocks/next-auth'
import { createRequest, TEST_USER } from '../../../test/helpers'
import { GET, POST } from './route'

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/items', () => {
  it('returns items for authenticated user', async () => {
    const items = [
      { id: 'item-1', name: 'Test Item', userId: TEST_USER.id, priceHistory: [] },
    ]
    prismaMock.item.findMany.mockResolvedValue(items as any)

    const res = await GET(createRequest('/api/items'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('Test Item')
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET(createRequest('/api/items'))
    expect(res.status).toBe(401)
  })

  it('returns empty array when no items', async () => {
    prismaMock.item.findMany.mockResolvedValue([])

    const res = await GET(createRequest('/api/items'))
    const data = await res.json()

    expect(data).toEqual([])
  })
})

describe('POST /api/items', () => {
  it('creates an item with valid data', async () => {
    const item = {
      id: 'new-item',
      name: 'New Item',
      price: '$29.99',
      priceValue: 29.99,
      url: 'https://example.com/product',
      domain: 'example.com',
      userId: TEST_USER.id,
      priceHistory: [{ price: 29.99 }],
    }
    prismaMock.item.create.mockResolvedValue(item as any)

    const res = await POST(createRequest('/api/items', {
      method: 'POST',
      body: {
        name: 'New Item',
        price: '$29.99',
        priceValue: 29.99,
        url: 'https://example.com/product',
      },
    }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('New Item')
  })

  it('returns 400 for invalid data', async () => {
    const res = await POST(createRequest('/api/items', {
      method: 'POST',
      body: { name: '' },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await POST(createRequest('/api/items', {
      method: 'POST',
      body: { name: 'Test', url: 'https://example.com' },
    }))
    expect(res.status).toBe(401)
  })

  it('extracts domain from URL when not provided', async () => {
    prismaMock.item.create.mockResolvedValue({ id: 'item-1', priceHistory: [] } as any)

    await POST(createRequest('/api/items', {
      method: 'POST',
      body: {
        name: 'Item',
        url: 'https://shop.example.com/product',
      },
    }))

    expect(prismaMock.item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain: 'shop.example.com',
        }),
      })
    )
  })
})
