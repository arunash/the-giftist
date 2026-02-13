import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../../test/mocks/next-auth'
import { createRequest, TEST_USER } from '../../../../test/helpers'
import { GET, PATCH, DELETE } from './route'

const params = { params: { id: 'ev-1' } }

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/events/[id]', () => {
  it('returns event by shareUrl', async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({
      id: 'ev-1',
      name: 'Birthday',
      isPublic: true,
      userId: TEST_USER.id,
      user: { name: 'Test User' },
      items: [],
    } as any)

    const res = await GET(createRequest('/api/events/ev-1'), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.name).toBe('Birthday')
  })

  it('falls back to finding by ID', async () => {
    prismaMock.event.findUnique
      .mockResolvedValueOnce(null) // shareUrl lookup fails
      .mockResolvedValueOnce({
        id: 'ev-1',
        name: 'My Event',
        isPublic: true,
        userId: TEST_USER.id,
        user: { name: 'Test' },
        items: [],
      } as any)

    const res = await GET(createRequest('/api/events/ev-1'), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.name).toBe('My Event')
  })

  it('returns 404 when not found', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null)

    const res = await GET(createRequest('/api/events/nonexistent'), params)
    expect(res.status).toBe(404)
  })

  it('returns 404 for private event accessed by non-owner', async () => {
    prismaMock.event.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'ev-1',
        isPublic: false,
        userId: 'other-user',
        items: [],
      } as any)

    const res = await GET(createRequest('/api/events/ev-1'), params)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/events/[id]', () => {
  it('updates event name', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'ev-1', userId: TEST_USER.id } as any)
    prismaMock.event.update.mockResolvedValue({ id: 'ev-1', name: 'Updated', items: [] } as any)

    const res = await PATCH(
      createRequest('/api/events/ev-1', { method: 'PATCH', body: { name: 'Updated' } }),
      params
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.name).toBe('Updated')
  })

  it('updates event items', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'ev-1', userId: TEST_USER.id } as any)
    prismaMock.eventItem.deleteMany.mockResolvedValue({ count: 0 } as any)
    prismaMock.eventItem.createMany.mockResolvedValue({ count: 2 } as any)
    prismaMock.event.update.mockResolvedValue({ id: 'ev-1', items: [] } as any)

    await PATCH(
      createRequest('/api/events/ev-1', {
        method: 'PATCH',
        body: { itemIds: ['item-a', 'item-b'] },
      }),
      params
    )

    expect(prismaMock.eventItem.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'ev-1' } })
    expect(prismaMock.eventItem.createMany).toHaveBeenCalled()
  })

  it('returns 404 if not owned', async () => {
    prismaMock.event.findFirst.mockResolvedValue(null)

    const res = await PATCH(
      createRequest('/api/events/ev-1', { method: 'PATCH', body: { name: 'x' } }),
      params
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await PATCH(
      createRequest('/api/events/ev-1', { method: 'PATCH', body: { name: 'x' } }),
      params
    )
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/events/[id]', () => {
  it('deletes an event', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'ev-1', userId: TEST_USER.id } as any)
    prismaMock.event.delete.mockResolvedValue({} as any)

    const res = await DELETE(createRequest('/api/events/ev-1', { method: 'DELETE' }), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('returns 404 if not owned', async () => {
    prismaMock.event.findFirst.mockResolvedValue(null)

    const res = await DELETE(createRequest('/api/events/ev-1', { method: 'DELETE' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await DELETE(createRequest('/api/events/ev-1', { method: 'DELETE' }), params)
    expect(res.status).toBe(401)
  })
})
