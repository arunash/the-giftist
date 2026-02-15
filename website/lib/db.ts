import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const client = new PrismaClient()
  // Enable WAL mode for better concurrent read/write performance
  client.$executeRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {})
  client.$executeRawUnsafe('PRAGMA busy_timeout = 5000').catch(() => {})
  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
