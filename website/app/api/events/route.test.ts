import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../test/mocks/next-auth'
import { createRequest, TEST_USER } from '../../../test/helpers'
import { GET, POST } from './route'

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/events', () => {
  it('returns events for authenticated user', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: 'Birthday', userId: TEST_USER.id, items: [] },
    ] as any)

    const res = await GET(createRequest('/api/events'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('Birthday')
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET(createRequest('/api/events'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/events', () => {
  it('creates an event', async () => {
    prismaMock.event.create.mockResolvedValue({
      id: 'ev-new',
      name: 'Wedding',
      type: 'WEDDING',
      date: new Date('2025-06-15'),
      items: [],
    } as any)

    const res = await POST(createRequest('/api/events', {
      method: 'POST',
      body: {
        name: 'Wedding',
        type: 'WEDDING',
        date: '2025-06-15',
      },
    }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('Wedding')
  })

  it('creates event with item IDs', async () => {
    prismaMock.event.create.mockResolvedValue({ id: 'ev-1', items: [] } as any)

    await POST(createRequest('/api/events', {
      method: 'POST',
      body: {
        name: 'Party',
        type: 'BIRTHDAY',
        date: '2025-01-01',
        itemIds: ['item-1', 'item-2'],
      },
    }))

    expect(prismaMock.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              { itemId: 'item-1', priority: 0 },
              { itemId: 'item-2', priority: 1 },
            ],
          },
        }),
      })
    )
  })

  it('returns 400 for invalid event type', async () => {
    const res = await POST(createRequest('/api/events', {
      method: 'POST',
      body: {
        name: 'Test',
        type: 'INVALID_TYPE',
        date: '2025-01-01',
      },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await POST(createRequest('/api/events', {
      method: 'POST',
      body: { name: 'Test', type: 'BIRTHDAY', date: '2025-01-01' },
    }))
    expect(res.status).toBe(401)
  })
})
