import { describe, it, expect } from 'vitest'
import { getClient } from './helpers/api-client'

describe('Circle API', () => {
  let memberId: string

  it('POST /api/circle adds a circle member', async () => {
    const res = await getClient().post('/api/circle', {
      phone: '15551234567',
      name: 'Test Friend',
      relationship: 'friend',
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Test Friend')
    expect(data.id).toBeDefined()
    memberId = data.id
  })

  it('GET /api/circle lists circle members', async () => {
    const res = await getClient().get('/api/circle')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.some((m: any) => m.id === memberId)).toBe(true)
  })

  it('POST /api/circle upserts on same phone', async () => {
    const res = await getClient().post('/api/circle', {
      phone: '15551234567',
      name: 'Updated Friend Name',
      relationship: 'family',
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Updated Friend Name')
    expect(data.relationship).toBe('family')
  })

  it('DELETE /api/circle/:id removes a member', async () => {
    const res = await getClient().delete(`/api/circle/${memberId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('GET /api/circle no longer includes deleted member', async () => {
    const res = await getClient().get('/api/circle')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.some((m: any) => m.id === memberId)).toBe(false)
  })
})
