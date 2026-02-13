import { vi } from 'vitest'
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

export const prismaMock = mockDeep<PrismaClient>()

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}))

export function resetPrismaMock() {
  mockReset(prismaMock)
}
