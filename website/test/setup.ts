import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

// Set test env vars
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_xxx'
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456'
process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'

beforeEach(() => {
  vi.restoreAllMocks()
})
