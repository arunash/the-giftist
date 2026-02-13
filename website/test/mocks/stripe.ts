import { vi } from 'vitest'

export const stripeMock = {
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      }),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
}

vi.mock('@/lib/stripe', () => ({
  stripe: stripeMock,
}))
