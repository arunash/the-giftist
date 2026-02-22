import { describe, it, expect } from 'vitest'
import { getClient } from './helpers/api-client'

describe('Wallet API', () => {
  it('GET /api/wallet creates wallet if missing and returns balance', async () => {
    const res = await getClient().get('/api/wallet')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('balance')
    expect(typeof data.balance).toBe('number')
    expect(data).toHaveProperty('transactions')
    expect(Array.isArray(data.transactions)).toBe(true)
  })

  it('GET /api/wallet returns same wallet on second call', async () => {
    const res = await getClient().get('/api/wallet')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance).toBe(0)
  })
})
