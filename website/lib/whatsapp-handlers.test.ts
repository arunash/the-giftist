import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../test/mocks/prisma'

// Mock external dependencies
vi.mock('@/lib/extract', () => ({
  extractProductFromUrl: vi.fn().mockResolvedValue({
    name: 'Test Product',
    price: '$29.99',
    priceValue: 29.99,
    image: 'https://example.com/img.jpg',
    url: 'https://example.com/product',
    domain: 'example.com',
  }),
}))

vi.mock('@/lib/extract-image', () => ({
  extractProductFromImage: vi.fn().mockResolvedValue({
    name: 'Camera',
    price: '$199.99',
    priceValue: 199.99,
    brand: 'Canon',
    description: 'A camera',
  }),
}))

vi.mock('@/lib/whatsapp', () => ({
  sendTextMessage: vi.fn().mockResolvedValue({}),
  sendImageMessage: vi.fn().mockResolvedValue({}),
  downloadMedia: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  normalizePhone: vi.fn((phone: string) => {
    const digits = phone.replace(/\D/g, '')
    return digits.length === 10 ? '1' + digits : digits
  }),
}))

vi.mock('@/lib/chat-context', () => ({
  buildChatContext: vi.fn().mockResolvedValue('System prompt'),
  checkChatLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
}))

vi.mock('@/lib/search-retailers', () => ({
  searchRetailers: vi.fn().mockResolvedValue({
    bestResult: {
      url: 'https://amazon.com/product',
      retailer: 'Amazon',
      price: '$199.99',
      priceValue: 199.99,
    },
    results: [{ url: 'https://amazon.com/product', retailer: 'Amazon', price: '$199.99', priceValue: 199.99 }],
  }),
}))

vi.mock('@/lib/activity', () => ({
  createActivity: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/enrich-item', () => ({
  enrichItem: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/platform-fee', () => ({
  calculateGoalAmount: vi.fn((price: number | null) => ({
    goalAmount: price || null, feeRate: 0, feeAmount: 0,
  })),
}))

vi.mock('@/lib/api-logger', () => ({
  logApiCall: vi.fn().mockResolvedValue({}),
  logError: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/parse-chat-content', () => ({
  stripSpecialBlocks: vi.fn((text: string) => text),
  parseChatContent: vi.fn(() => []),
}))

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'As your Gift Concierge, here are some great picks for you!' }],
        }),
      }
    },
  }
})

import { resolveUserAndList, handleTextMessage, handleImageMessage, getHelpMessage, getWelcomeMessage } from './whatsapp-handlers'
import { extractProductFromUrl } from '@/lib/extract'
import { extractProductFromImage } from '@/lib/extract-image'
import { downloadMedia, sendImageMessage } from '@/lib/whatsapp'

beforeEach(() => {
  prismaMock.item.create.mockResolvedValue({ id: 'item-new', name: 'Test' } as any)
  prismaMock.giftListItem.create.mockResolvedValue({} as any)
  prismaMock.chatMessage.create.mockResolvedValue({} as any)
  prismaMock.chatMessage.findMany.mockResolvedValue([])
  prismaMock.event.findMany.mockResolvedValue([])
  prismaMock.item.count.mockResolvedValue(1)
  prismaMock.chatMessage.count.mockResolvedValue(1)
  prismaMock.user.update.mockResolvedValue({ id: 'user-1', pendingProduct: null, lifetimeContributionsReceived: 0 } as any)
  prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '15551234567', pendingProduct: null } as any)
})

describe('resolveUserAndList', () => {
  it('returns existing user and list', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '15551234567' } as any)
    prismaMock.giftList.findFirst.mockResolvedValue({ id: 'list-1', name: 'WhatsApp Saves' } as any)

    const result = await resolveUserAndList('15551234567', 'Test')

    expect(result.userId).toBe('user-1')
    expect(result.listId).toBe('list-1')
    expect(result.isNewUser).toBe(false)
  })

  it('creates new user and list', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ id: 'user-new' } as any)
    prismaMock.giftList.findFirst.mockResolvedValue(null)
    prismaMock.giftList.create.mockResolvedValue({ id: 'list-new' } as any)

    const result = await resolveUserAndList('19999999999', 'New User')

    expect(result.userId).toBe('user-new')
    expect(result.listId).toBe('list-new')
    expect(result.isNewUser).toBe(true)
  })
})

describe('handleTextMessage', () => {
  it('returns help for "help"', async () => {
    const reply = await handleTextMessage('user-1', 'list-1', 'help', '15551234567')
    expect(reply).toContain('The Giftist')
  })

  it('routes "hello" to Claude chat', async () => {
    prismaMock.chatMessage.create.mockResolvedValue({} as any)
    prismaMock.chatMessage.findMany.mockResolvedValue([
      { role: 'USER', content: 'hello', createdAt: new Date() },
    ] as any)

    const reply = await handleTextMessage('user-1', 'list-1', 'hello', '15551234567')
    expect(reply).toBeTruthy()
    // hello now goes to Claude chat instead of static help
  })

  it('returns list of items for "list"', async () => {
    prismaMock.giftListItem.findMany.mockResolvedValue([
      { item: { name: 'Shoes', price: '$50' } },
      { item: { name: 'Watch', price: null } },
    ] as any)

    const reply = await handleTextMessage('user-1', 'list-1', 'list', '15551234567')
    expect(reply).toContain('1. Shoes ($50)')
    expect(reply).toContain('2. Watch')
  })

  it('returns empty message for "list" when empty', async () => {
    prismaMock.giftListItem.findMany.mockResolvedValue([])

    const reply = await handleTextMessage('user-1', 'list-1', 'list', '15551234567')
    expect(reply).toContain('empty')
  })

  it('extracts and saves a URL', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null) // no duplicate

    const reply = await handleTextMessage('user-1', 'list-1', 'Check this out https://example.com/product', '15551234567')

    expect(extractProductFromUrl).toHaveBeenCalledWith('https://example.com/product')
    expect(prismaMock.item.create).toHaveBeenCalled()
    expect(prismaMock.giftListItem.create).toHaveBeenCalled()
  })

  it('detects duplicate URLs', async () => {
    prismaMock.item.findFirst.mockResolvedValue({ name: 'Already Saved' } as any)

    const reply = await handleTextMessage('user-1', 'list-1', 'https://example.com/product', '15551234567')
    expect(reply).toContain('already saved')
  })

  it('routes plain text to Claude chat', async () => {
    prismaMock.chatMessage.create.mockResolvedValue({} as any)
    prismaMock.chatMessage.findMany.mockResolvedValue([
      { role: 'USER', content: 'just some random text', createdAt: new Date() },
    ] as any)

    const reply = await handleTextMessage('user-1', 'list-1', 'just some random text', '15551234567')
    expect(reply).toContain('Gift Concierge')
  })
})

describe('handleImageMessage', () => {
  it('extracts product from image and asks for confirmation', async () => {
    const reply = await handleImageMessage('user-1', 'list-1', 'media-1', 'image/jpeg', undefined, '15551234567')

    expect(downloadMedia).toHaveBeenCalledWith('media-1')
    expect(extractProductFromImage).toHaveBeenCalled()
    // Product is stored as pending for user confirmation
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingProduct: expect.stringContaining('Canon Camera'),
        }),
      })
    )
  })

  it('falls back to text handler when caption contains URL', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null) // no duplicate

    const reply = await handleImageMessage(
      'user-1', 'list-1', 'media-1', 'image/jpeg',
      'Check this https://example.com/product', '15551234567'
    )

    // Should delegate to URL extraction, not image extraction
    expect(extractProductFromUrl).toHaveBeenCalled()
  })

  it('handles download failure', async () => {
    vi.mocked(downloadMedia).mockRejectedValueOnce(new Error('Download failed'))

    const reply = await handleImageMessage('user-1', 'list-1', 'media-1', 'image/jpeg', undefined, '15551234567')
    expect(reply).toContain("Couldn't download")
  })

  it('handles product not identified', async () => {
    vi.mocked(extractProductFromImage).mockResolvedValueOnce(null)

    const reply = await handleImageMessage('user-1', 'list-1', 'media-1', 'image/jpeg', undefined, '15551234567')
    expect(reply).toContain("Couldn't identify")
  })
})

describe('getWelcomeMessage', () => {
  it('includes name when provided', () => {
    expect(getWelcomeMessage('Alice')).toContain('Hi Alice')
  })

  it('uses generic greeting without name', () => {
    expect(getWelcomeMessage()).toContain('Hi there')
  })
})

describe('getHelpMessage', () => {
  it('includes instructions', () => {
    const msg = getHelpMessage()
    expect(msg).toContain('Send a link')
    expect(msg).toContain('Send a photo')
    expect(msg).toContain('list')
    expect(msg).toContain('remove')
  })
})
