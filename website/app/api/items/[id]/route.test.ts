import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../../test/mocks/next-auth'
import { createRequest, TEST_USER } from '../../../../test/helpers'
import { GET, PATCH, DELETE } from './route'

const params = { params: { id: 'item-1' } }

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/items/[id]', () => {
  it('returns item for owner', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-1',
      name: 'Test Item',
      userId: TEST_USER.id,
      priceHistory: [],
      contributions: [],
    } as any)

    const res = await GET(createRequest('/api/items/item-1'), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.name).toBe('Test Item')
  })

  it('returns 404 for non-existent item', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null)

    const res = await GET(createRequest('/api/items/nonexistent'), params)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET(createRequest('/api/items/item-1'), params)
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/items/[id]', () => {
  it('updates an item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-1',
      userId: TEST_USER.id,
      priceValue: 20,
      isPurchased: false,
    } as any)
    prismaMock.item.update.mockResolvedValue({
      id: 'item-1',
      name: 'Updated Name',
      priceHistory: [],
    } as any)

    const res = await PATCH(
      createRequest('/api/items/item-1', {
        method: 'PATCH',
        body: { name: 'Updated Name' },
      }),
      params
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.name).toBe('Updated Name')
  })

  it('returns 404 if item not owned by user', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null)

    const res = await PATCH(
      createRequest('/api/items/item-1', {
        method: 'PATCH',
        body: { name: 'Updated' },
      }),
      params
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid data', async () => {
    const res = await PATCH(
      createRequest('/api/items/item-1', {
        method: 'PATCH',
        body: { name: '' },
      }),
      params
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await PATCH(
      createRequest('/api/items/item-1', {
        method: 'PATCH',
        body: { name: 'Test' },
      }),
      params
    )
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/items/[id]', () => {
  it('deletes an item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-1',
      userId: TEST_USER.id,
    } as any)
    prismaMock.item.delete.mockResolvedValue({} as any)

    const res = await DELETE(createRequest('/api/items/item-1', { method: 'DELETE' }), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('returns 404 if item not owned', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null)

    const res = await DELETE(createRequest('/api/items/item-1', { method: 'DELETE' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await DELETE(createRequest('/api/items/item-1', { method: 'DELETE' }), params)
    expect(res.status).toBe(401)
  })
})
