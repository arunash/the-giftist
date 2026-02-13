import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../../test/mocks/next-auth'
import { GET } from './route'

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/chat/history', () => {
  it('returns chat messages in chronological order', async () => {
    const messages = [
      { id: 'msg-2', role: 'ASSISTANT', content: 'Hi!', createdAt: new Date('2024-01-02') },
      { id: 'msg-1', role: 'USER', content: 'Hello', createdAt: new Date('2024-01-01') },
    ]
    prismaMock.chatMessage.findMany.mockResolvedValue(messages as any)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    // Messages are reversed from desc to chronological
    expect(data[0].id).toBe('msg-1')
    expect(data[1].id).toBe('msg-2')
  })

  it('returns empty array when no messages', async () => {
    prismaMock.chatMessage.findMany.mockResolvedValue([])

    const res = await GET()
    const data = await res.json()

    expect(data).toEqual([])
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET()
    expect(res.status).toBe(401)
  })
})
