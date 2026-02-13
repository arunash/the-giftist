import { vi } from 'vitest'

export const anthropicMock = {
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"name": "Test Product", "price": "$29.99", "priceValue": 29.99, "brand": "TestBrand", "description": "A test product"}' }],
    }),
  },
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => anthropicMock),
}))
