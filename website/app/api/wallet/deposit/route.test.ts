import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../../test/mocks/next-auth'
import '../../../../test/mocks/stripe'
import { createRequest } from '../../../../test/helpers'
import { POST } from './route'

beforeEach(() => {
  setAuthenticated()
  prismaMock.wallet.findUnique.mockResolvedValue({ id: 'wallet-1' } as any)
  prismaMock.walletTransaction.create.mockResolvedValue({} as any)
})

describe('POST /api/wallet/deposit', () => {
  it('creates a Stripe checkout session', async () => {
    const res = await POST(createRequest('/api/wallet/deposit', {
      method: 'POST',
      body: { amount: 50 },
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.url).toBe('https://checkout.stripe.com/test')
  })

  it('auto-creates wallet if needed', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue(null)
    prismaMock.wallet.create.mockResolvedValue({ id: 'new-wallet' } as any)

    const res = await POST(createRequest('/api/wallet/deposit', {
      method: 'POST',
      body: { amount: 25 },
    }))

    expect(res.status).toBe(200)
    expect(prismaMock.wallet.create).toHaveBeenCalled()
  })

  it('returns 400 for invalid amount', async () => {
    const res = await POST(createRequest('/api/wallet/deposit', {
      method: 'POST',
      body: { amount: 0 },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for amount over max', async () => {
    const res = await POST(createRequest('/api/wallet/deposit', {
      method: 'POST',
      body: { amount: 20000 },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await POST(createRequest('/api/wallet/deposit', {
      method: 'POST',
      body: { amount: 50 },
    }))
    expect(res.status).toBe(401)
  })
})
