import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../../test/mocks/next-auth'
import { createRequest, TEST_USER } from '../../../../test/helpers'
import { POST } from './route'

beforeEach(() => {
  setAuthenticated()
  prismaMock.activityEvent.create.mockResolvedValue({} as any)
})

describe('POST /api/wallet/fund-item', () => {
  it('funds an item successfully', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        wallet: {
          findUnique: async () => ({ id: 'w-1', balance: 100 }),
          update: async () => ({}),
        },
        item: {
          findFirst: async () => ({ id: 'item-1', userId: TEST_USER.id, name: 'Test Item', goalAmount: 100, priceValue: 100 }),
          update: async () => ({ id: 'item-1', name: 'Test Item', fundedAmount: 50 }),
        },
        walletTransaction: {
          create: async () => ({}),
        },
        contribution: {
          create: async () => ({}),
        },
        user: {
          update: async () => ({}),
        },
      }
      return fn(tx)
    })

    const res = await POST(createRequest('/api/wallet/fund-item', {
      method: 'POST',
      body: { itemId: 'item-1', amount: 50 },
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.balance).toBe(50)
    expect(data.fundedAmount).toBe(50)
  })

  it('returns 400 for insufficient balance', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        wallet: {
          findUnique: async () => ({ id: 'w-1', balance: 10 }),
        },
        item: { findFirst: async () => null },
        walletTransaction: { create: async () => ({}) },
      }
      return fn(tx)
    })

    const res = await POST(createRequest('/api/wallet/fund-item', {
      method: 'POST',
      body: { itemId: 'item-1', amount: 50 },
    }))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Insufficient')
  })

  it('returns 400 when no wallet exists', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        wallet: { findUnique: async () => null },
        item: { findFirst: async () => null },
        walletTransaction: { create: async () => ({}) },
      }
      return fn(tx)
    })

    const res = await POST(createRequest('/api/wallet/fund-item', {
      method: 'POST',
      body: { itemId: 'item-1', amount: 50 },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        wallet: {
          findUnique: async () => ({ id: 'w-1', balance: 100 }),
        },
        item: { findFirst: async () => null },
        walletTransaction: { create: async () => ({}) },
      }
      return fn(tx)
    })

    const res = await POST(createRequest('/api/wallet/fund-item', {
      method: 'POST',
      body: { itemId: 'nonexistent', amount: 50 },
    }))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await POST(createRequest('/api/wallet/fund-item', {
      method: 'POST',
      body: { itemId: 'item-1', amount: 50 },
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid schema', async () => {
    const res = await POST(createRequest('/api/wallet/fund-item', {
      method: 'POST',
      body: { itemId: 'item-1', amount: -10 },
    }))
    expect(res.status).toBe(400)
  })
})
