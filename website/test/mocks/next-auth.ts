import { vi } from 'vitest'
import { TEST_USER } from '../helpers'

const mockGetServerSession = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

export function setAuthenticated(user = TEST_USER) {
  mockGetServerSession.mockResolvedValue({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
  })
}

export function setUnauthenticated() {
  mockGetServerSession.mockResolvedValue(null)
}

export { mockGetServerSession }
