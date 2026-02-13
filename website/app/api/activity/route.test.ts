import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../test/mocks/next-auth'
import { createRequest, TEST_USER } from '../../../test/helpers'
import { GET } from './route'

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/activity', () => {
  it('returns own activity by default', async () => {
    prismaMock.activityEvent.findMany.mockResolvedValue([
      { id: 'act-1', type: 'ITEM_ADDED', createdAt: new Date(), user: { name: 'Test' }, item: null },
    ] as any)

    const res = await GET(createRequest('/api/activity'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(prismaMock.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: TEST_USER.id }),
      })
    )
  })

  it('returns community activity', async () => {
    prismaMock.activityEvent.findMany.mockResolvedValue([])

    await GET(createRequest('/api/activity?tab=community'))

    expect(prismaMock.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visibility: 'PUBLIC' }),
      })
    )
  })

  it('paginates with cursor', async () => {
    const activities = Array.from({ length: 21 }, (_, i) => ({
      id: `act-${i}`,
      createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      user: { name: 'Test' },
      item: null,
    }))
    prismaMock.activityEvent.findMany.mockResolvedValue(activities as any)

    const res = await GET(createRequest('/api/activity?limit=20'))
    const data = await res.json()

    expect(data.items).toHaveLength(20)
    expect(data.nextCursor).toBeTruthy()
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET(createRequest('/api/activity'))
    expect(res.status).toBe(401)
  })
})
