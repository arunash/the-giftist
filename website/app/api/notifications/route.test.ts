import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '@/test/mocks/next-auth'
import { createRequest, TEST_USER } from '@/test/helpers'
import { GET } from './route'
import { POST } from './read/route'
import { GET as GETCount } from './count/route'

const mockNotification = (overrides = {}) => ({
  id: 'notif-1',
  userId: TEST_USER.id,
  type: 'ITEM_ADDED',
  title: 'Item added',
  body: 'Test item added',
  metadata: null,
  read: false,
  channel: 'IN_APP',
  createdAt: new Date('2025-01-01T12:00:00Z'),
  ...overrides,
})

describe('GET /api/notifications', () => {
  beforeEach(() => {
    resetPrismaMock()
    setAuthenticated()
  })

  it('returns paginated notifications', async () => {
    const notifications = [
      mockNotification({ id: 'notif-1' }),
      mockNotification({ id: 'notif-2' }),
    ]
    prismaMock.notification.findMany.mockResolvedValue(notifications)
    prismaMock.notification.count.mockResolvedValue(1)

    const req = createRequest('/api/notifications')
    const res = await GET(req)
    const data = await res.json()

    expect(data.notifications).toHaveLength(2)
    expect(data.unreadCount).toBe(1)
    expect(data.nextCursor).toBeNull()
  })

  it('filters unread only when requested', async () => {
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)

    const req = createRequest('/api/notifications?unread=true')
    await GET(req)

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ read: false }),
      })
    )
  })

  it('returns correct unreadCount', async () => {
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(5)

    const req = createRequest('/api/notifications')
    const res = await GET(req)
    const data = await res.json()

    expect(data.unreadCount).toBe(5)
  })

  it('returns empty list for new users', async () => {
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)

    const req = createRequest('/api/notifications')
    const res = await GET(req)
    const data = await res.json()

    expect(data.notifications).toHaveLength(0)
    expect(data.unreadCount).toBe(0)
  })
})

describe('POST /api/notifications/read', () => {
  beforeEach(() => {
    resetPrismaMock()
    setAuthenticated()
  })

  it('marks specific notifications as read', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 2 })

    const req = createRequest('/api/notifications/read', {
      method: 'POST',
      body: { notificationIds: ['notif-1', 'notif-2'] },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['notif-1', 'notif-2'] },
        userId: TEST_USER.id,
      },
      data: { read: true },
    })
  })

  it('marks all as read with all: true', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 5 })

    const req = createRequest('/api/notifications/read', {
      method: 'POST',
      body: { all: true },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: TEST_USER.id, read: false },
      data: { read: true },
    })
  })

  it('returns 400 for invalid body', async () => {
    const req = createRequest('/api/notifications/read', {
      method: 'POST',
      body: {},
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})

describe('GET /api/notifications/count', () => {
  beforeEach(() => {
    resetPrismaMock()
    setAuthenticated()
  })

  it('returns unread count', async () => {
    prismaMock.notification.count.mockResolvedValue(3)

    const res = await GETCount()
    const data = await res.json()

    expect(data.unreadCount).toBe(3)
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: TEST_USER.id, read: false },
    })
  })
})

describe('Authentication', () => {
  beforeEach(() => {
    resetPrismaMock()
    setUnauthenticated()
  })

  it('rejects unauthenticated requests to GET /api/notifications', async () => {
    const req = createRequest('/api/notifications')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated requests to POST /api/notifications/read', async () => {
    const req = createRequest('/api/notifications/read', {
      method: 'POST',
      body: { all: true },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated requests to GET /api/notifications/count', async () => {
    const res = await GETCount()
    expect(res.status).toBe(401)
  })
})
