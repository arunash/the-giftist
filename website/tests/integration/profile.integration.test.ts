import { describe, it, expect } from 'vitest'
import { getClient } from './helpers/api-client'

describe('Profile API', () => {
  it('GET /api/profile returns user profile', async () => {
    const res = await getClient().get('/api/profile')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('shareId')
  })

  it('PATCH /api/profile updates interests', async () => {
    const res = await getClient().patch('/api/profile', {
      interests: ['books', 'tech'],
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.interests).toEqual(['books', 'tech'])
  })

  it('PATCH /api/profile updates gender', async () => {
    const res = await getClient().patch('/api/profile', {
      gender: 'PREFER_NOT_TO_SAY',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.gender).toBe('PREFER_NOT_TO_SAY')
  })

  it('PATCH /api/profile clears optional fields with null', async () => {
    const res = await getClient().patch('/api/profile', {
      gender: null,
      interests: null,
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.gender).toBeNull()
  })
})
