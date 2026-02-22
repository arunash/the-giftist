import { encode } from 'next-auth/jwt'

export const TEST_USER_ID = 'integration-test-user'
export const TEST_USER_PHONE = '15550000000'
export const TEST_USER_NAME = '__INTEGRATION_TEST__'

export async function generateTestToken(): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET env var is required for integration tests')

  const token = await encode({
    token: {
      sub: TEST_USER_ID,
      id: TEST_USER_ID,
      name: TEST_USER_NAME,
      phone: TEST_USER_PHONE,
    },
    secret,
  })

  return token
}
