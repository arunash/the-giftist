import { describe, it, expect } from 'vitest'
import { getClient } from './helpers/api-client'

describe('Events CRUD', () => {
  let eventId: string
  let itemId: string

  it('POST /api/events creates an event', async () => {
    const res = await getClient().post('/api/events', {
      name: 'Integration Test Birthday',
      type: 'BIRTHDAY',
      date: new Date(Date.now() + 30 * 86400000).toISOString(),
      description: 'Test event for integration tests',
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Integration Test Birthday')
    expect(data.id).toBeDefined()
    eventId = data.id
  })

  it('GET /api/events lists events including the new one', async () => {
    const res = await getClient().get('/api/events')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.some((e: any) => e.id === eventId)).toBe(true)
  })

  it('GET /api/events/:id returns the event', async () => {
    const res = await getClient().get(`/api/events/${eventId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(eventId)
  })

  it('PATCH /api/events/:id updates the event', async () => {
    const res = await getClient().patch(`/api/events/${eventId}`, {
      description: 'Updated description',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.description).toBe('Updated description')
  })

  it('PATCH /api/events/:id links an item to the event', async () => {
    // Create an item first
    const itemRes = await getClient().post('/api/items', {
      name: 'Event-linked Item',
      url: 'https://example.com/event-item',
      source: 'MANUAL',
    })
    expect(itemRes.status).toBe(201)
    const item = await itemRes.json()
    itemId = item.id

    const res = await getClient().patch(`/api/events/${eventId}`, {
      itemIds: [itemId],
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items.some((ei: any) => ei.itemId === itemId)).toBe(true)
  })

  it('DELETE /api/events/:id deletes the event', async () => {
    const res = await getClient().delete(`/api/events/${eventId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
