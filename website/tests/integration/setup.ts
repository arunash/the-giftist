import { seedTestUser, cleanupTestData, disconnectPrisma } from './helpers/seed'
import { generateTestToken } from './helpers/auth'
import { initApiClient } from './helpers/api-client'

beforeAll(async () => {
  await seedTestUser()
  await cleanupTestData()
  const token = await generateTestToken()
  initApiClient(token)
}, 30_000)

afterAll(async () => {
  await cleanupTestData()
  await disconnectPrisma()
}, 30_000)
