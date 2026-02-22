import { describe, it, expect } from 'vitest'
import { getClient } from './helpers/api-client'

describe('Activity API', () => {
  it('creates items to generate activity', async () => {
    const res = await getClient().post('/api/items', {
      name: 'Activity Test Item',
      url: 'https://example.com/activity-item',
      source: 'MANUAL',
    })
    expect(res.status).toBe(201)
  })

  it('GET /api/activity returns activity events', async () => {
    const res = await getClient().get('/api/activity?tab=mine&limit=10')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('items')
    expect(Array.isArray(data.items)).toBe(true)
    expect(data).toHaveProperty('nextCursor')
  })

  it('GET /api/activity with community tab works', async () => {
    const res = await getClient().get('/api/activity?tab=community&limit=5')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('items')
    expect(Array.isArray(data.items)).toBe(true)
  })
})
