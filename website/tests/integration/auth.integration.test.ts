import { describe, it, expect } from 'vitest'
import { getClient, getBaseUrl } from './helpers/api-client'

describe('Auth smoke test', () => {
  it('GET /api/profile returns 200 with valid token', async () => {
    const res = await getClient().get('/api/profile')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('name')
  })

  it('GET /api/profile returns 401 without token', async () => {
    const res = await fetch(`${getBaseUrl()}/api/profile`)
    expect(res.status).toBe(401)
  })
})
