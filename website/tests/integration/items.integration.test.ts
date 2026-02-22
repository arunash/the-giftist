import { describe, it, expect } from 'vitest'
import { getClient } from './helpers/api-client'

describe('Items CRUD', () => {
  let itemId: string

  it('POST /api/items creates an item', async () => {
    const res = await getClient().post('/api/items', {
      name: 'Integration Test Item',
      url: 'https://example.com/test-product',
      price: '$29.99',
      priceValue: 29.99,
      source: 'MANUAL',
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Integration Test Item')
    expect(data.id).toBeDefined()
    itemId = data.id
  })

  it('GET /api/items lists items including the new one', async () => {
    const res = await getClient().get('/api/items')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.some((i: any) => i.id === itemId)).toBe(true)
  })

  it('GET /api/items/:id returns the item', async () => {
    const res = await getClient().get(`/api/items/${itemId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(itemId)
    expect(data.name).toBe('Integration Test Item')
  })

  it('PATCH /api/items/:id updates the item', async () => {
    const res = await getClient().patch(`/api/items/${itemId}`, {
      name: 'Updated Test Item',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Updated Test Item')
  })

  it('DELETE /api/items/:id deletes the item', async () => {
    const res = await getClient().delete(`/api/items/${itemId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('GET /api/items/:id returns 404 after deletion', async () => {
    const res = await getClient().get(`/api/items/${itemId}`)
    expect(res.status).toBe(404)
  })
})
