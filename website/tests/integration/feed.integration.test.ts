import { describe, it, expect } from 'vitest'
import { getClient } from './helpers/api-client'

describe('Feed API', () => {
  it('POST /api/items creates a feed item with image', async () => {
    const res = await getClient().post('/api/items', {
      name: 'Feed Test Item',
      url: 'https://example.com/feed-item',
      image: 'https://example.com/image.jpg',
      price: '$49.99',
      priceValue: 49.99,
      source: 'MANUAL',
    })
    expect(res.status).toBe(201)
  })

  it('GET /api/feed returns 200 with items array', async () => {
    const res = await getClient().get('/api/feed')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('items')
    expect(Array.isArray(data.items)).toBe(true)
    expect(data).toHaveProperty('nextCursor')
    expect(data).toHaveProperty('categories')
  })

  it('GET /api/feed with filters works', async () => {
    const res = await getClient().get('/api/feed?filter=all&sort=newest&limit=5')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items.length).toBeLessThanOrEqual(5)
  })
})
