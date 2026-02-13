import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { stripeMock } from '../../../../test/mocks/stripe'
import { createRequest } from '../../../../test/helpers'
import { POST } from './route'

beforeEach(() => {
  prismaMock.activityEvent.create.mockResolvedValue({} as any)
})

describe('POST /api/webhooks/stripe', () => {
  it('returns 400 for missing signature', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    })
    // NextRequest wraps Request
    const { NextRequest } = await import('next/server')
    const nextReq = new NextRequest(req)

    const res = await POST(nextReq)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing signature')
  })

  it('returns 400 for invalid signature', async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const req = new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'invalid' },
      body: '{}',
    })
    const { NextRequest } = await import('next/server')
    const nextReq = new NextRequest(req)

    const res = await POST(nextReq)
    expect(res.status).toBe(400)
  })

  it('processes checkout.session.completed for wallet deposit', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 5000,
          metadata: {
            type: 'wallet_deposit',
            walletId: 'wallet-1',
            userId: 'user-1',
          },
        },
      },
    })

    prismaMock.wallet.update.mockResolvedValue({} as any)
    prismaMock.walletTransaction.updateMany.mockResolvedValue({ count: 1 } as any)

    const req = new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid' },
      body: '{}',
    })
    const { NextRequest } = await import('next/server')
    const nextReq = new NextRequest(req)

    const res = await POST(nextReq)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.received).toBe(true)
    expect(prismaMock.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { increment: 50 } },
    })
  })

  it('returns 200 for unhandled event types', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: {} },
    })

    const req = new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid' },
      body: '{}',
    })
    const { NextRequest } = await import('next/server')
    const nextReq = new NextRequest(req)

    const res = await POST(nextReq)
    expect(res.status).toBe(200)
  })
})
