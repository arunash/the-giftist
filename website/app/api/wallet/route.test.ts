import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../../test/mocks/prisma'
import { setAuthenticated, setUnauthenticated } from '../../../test/mocks/next-auth'
import { createRequest } from '../../../test/helpers'
import { GET } from './route'

beforeEach(() => {
  setAuthenticated()
})

describe('GET /api/wallet', () => {
  it('returns existing wallet', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: 100.50,
      transactions: [],
    } as any)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.balance).toBe(100.50)
  })

  it('auto-creates wallet when none exists', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue(null)
    prismaMock.wallet.create.mockResolvedValue({
      id: 'new-wallet',
      balance: 0,
      transactions: [],
    } as any)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.balance).toBe(0)
    expect(prismaMock.wallet.create).toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated()

    const res = await GET()
    expect(res.status).toBe(401)
  })
})
