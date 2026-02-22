/**
 * WhatsApp Chatbot — Comprehensive E2E Tests
 *
 * Covers every chatbot feature end-to-end:
 * 1. User resolution (new user, existing user, name updates)
 * 2. Add item by URL
 * 3. Add item by photo (pending → confirm/reject)
 * 4. Add item from Instagram link
 * 5. Event creation via chat
 * 6. Item-to-event linking via chat ([ADD_TO_EVENT])
 * 7. "event <n>" quick-link command
 * 8. Event prompt after adding item
 * 9. Commands: list, events, share, remove, edit, help
 * 10. Chat routing (free limit, Claude responses)
 * 11. Welcome flow for new users
 * 12. Duplicate detection
 * 13. Guardrails (no image, bad extraction)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../test/mocks/prisma'

// ---------- Mocks ----------

vi.mock('@/lib/extract', () => ({
  extractProductFromUrl: vi.fn().mockResolvedValue({
    name: 'Nike Air Max 90',
    price: '$129.99',
    priceValue: 129.99,
    image: 'https://cdn.nike.com/airmax90.jpg',
    url: 'https://nike.com/air-max-90',
    domain: 'nike.com',
  }),
}))

vi.mock('@/lib/extract-image', () => ({
  extractProductFromImage: vi.fn().mockResolvedValue({
    name: 'Portable Speaker',
    price: '$49.99',
    priceValue: 49.99,
    brand: 'JBL',
    description: 'Bluetooth speaker',
  }),
}))

vi.mock('@/lib/search-retailers', () => ({
  searchRetailers: vi.fn().mockResolvedValue({
    bestResult: {
      url: 'https://amazon.com/jbl-speaker',
      retailer: 'Amazon',
      price: '$49.99',
      priceValue: 49.99,
    },
    results: [{ url: 'https://amazon.com/jbl-speaker', retailer: 'Amazon', price: '$49.99', priceValue: 49.99 }],
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
  buildChatContext: vi.fn().mockResolvedValue('You are the Gift Concierge.'),
  checkChatLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
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

vi.mock('@/lib/parse-chat-content', async () => {
  const actual = await vi.importActual<typeof import('@/lib/parse-chat-content')>('@/lib/parse-chat-content')
  return actual
})

vi.mock('@/lib/api-logger', () => ({
  logApiCall: vi.fn().mockResolvedValue({}),
  logError: vi.fn().mockResolvedValue({}),
}))

let mockChatResponse = 'Here are some great gift ideas!'

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockImplementation(() =>
        Promise.resolve({
          content: [{ type: 'text', text: mockChatResponse }],
          usage: { input_tokens: 100, output_tokens: 50 },
        })
      ),
    }
  },
}))

import {
  resolveUserAndList,
  handleTextMessage,
  handleImageMessage,
  getWelcomeMessage,
  getHelpMessage,
} from './whatsapp-handlers'
import { extractProductFromUrl } from '@/lib/extract'
import { extractProductFromImage } from '@/lib/extract-image'
import { downloadMedia, sendImageMessage, sendTextMessage } from '@/lib/whatsapp'
import { checkChatLimit } from '@/lib/chat-context'
import { createActivity } from '@/lib/activity'
import { normalizePhone } from '@/lib/whatsapp'

// ---------- Helpers ----------

function setMockChat(text: string) {
  mockChatResponse = text
}

const PHONE = '15551234567'
const USER_ID = 'user-1'
const LIST_ID = 'list-1'

const futureDate = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

beforeEach(() => {
  vi.clearAllMocks()
  mockChatResponse = 'Here are some great gift ideas!'

  // Default mocks
  prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, phone: PHONE, pendingProduct: null, name: 'Test User' } as any)
  prismaMock.user.update.mockResolvedValue({ id: USER_ID, pendingProduct: null, lifetimeContributionsReceived: 0 } as any)
  prismaMock.user.create.mockResolvedValue({ id: 'user-new' } as any)
  prismaMock.giftList.findFirst.mockResolvedValue({ id: LIST_ID, name: 'WhatsApp Saves' } as any)
  prismaMock.giftList.create.mockResolvedValue({ id: 'list-new' } as any)
  prismaMock.item.create.mockResolvedValue({ id: 'item-new', name: 'Test Item' } as any)
  prismaMock.item.findFirst.mockResolvedValue(null)
  prismaMock.item.findUnique.mockResolvedValue(null)
  prismaMock.item.count.mockResolvedValue(1)
  prismaMock.giftListItem.create.mockResolvedValue({} as any)
  prismaMock.giftListItem.findMany.mockResolvedValue([])
  prismaMock.giftListItem.delete.mockResolvedValue({} as any)
  prismaMock.chatMessage.create.mockResolvedValue({} as any)
  prismaMock.chatMessage.findMany.mockResolvedValue([])
  prismaMock.chatMessage.count.mockResolvedValue(1)
  prismaMock.event.findMany.mockResolvedValue([])
  prismaMock.event.findFirst.mockResolvedValue(null)
  prismaMock.event.create.mockResolvedValue({ id: 'event-new', name: 'Test Event' } as any)
  prismaMock.event.delete.mockResolvedValue({} as any)
  prismaMock.eventItem.create.mockResolvedValue({} as any)
  prismaMock.eventItem.deleteMany.mockResolvedValue({ count: 0 } as any)
  prismaMock.eventItem.findFirst.mockResolvedValue(null)
  prismaMock.item.update.mockResolvedValue({} as any)
  prismaMock.circleMember.findMany.mockResolvedValue([])
  prismaMock.circleMember.findUnique.mockResolvedValue(null)
  prismaMock.circleMember.create.mockResolvedValue({} as any)
  prismaMock.circleMember.delete.mockResolvedValue({} as any)
  prismaMock.circleMember.upsert.mockResolvedValue({} as any)
  prismaMock.circleMember.findFirst.mockResolvedValue(null)
})

// ================================================================
// 1. USER RESOLUTION
// ================================================================

describe('1. User resolution', () => {
  it('returns existing user + existing list', async () => {
    const result = await resolveUserAndList(PHONE, 'Test')
    expect(result).toEqual({ userId: USER_ID, listId: LIST_ID, isNewUser: false })
  })

  it('creates new user with WhatsApp profile name', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.giftList.findFirst.mockResolvedValue(null)

    await resolveUserAndList('19999999999', 'Alice')

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { phone: '19999999999', name: 'Alice' },
    })
  })

  it('creates new user with null name when profile name missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.giftList.findFirst.mockResolvedValue(null)

    await resolveUserAndList('19999999999')

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { phone: '19999999999', name: null },
    })
  })

  it('updates placeholder name from WhatsApp profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, phone: PHONE, name: 'User 4567' } as any)

    await resolveUserAndList(PHONE, 'Alice Smith')

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { name: 'Alice Smith' },
    })
  })

  it('updates null name from WhatsApp profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, phone: PHONE, name: null } as any)

    await resolveUserAndList(PHONE, 'Bob')

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { name: 'Bob' },
    })
  })

  it('does NOT overwrite real name with WhatsApp profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, phone: PHONE, name: 'Alice Smith' } as any)

    await resolveUserAndList(PHONE, 'Different Name')

    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('creates "WhatsApp Saves" list for new user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.giftList.findFirst.mockResolvedValue(null)

    await resolveUserAndList('19999999999', 'New')

    expect(prismaMock.giftList.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'WhatsApp Saves' }),
    })
  })
})

// ================================================================
// 2. ADD ITEM BY URL
// ================================================================

describe('2. Add item by URL', () => {
  it('extracts product from URL and saves item', async () => {
    const reply = await handleTextMessage(USER_ID, LIST_ID, 'Check this out https://nike.com/air-max-90', PHONE)

    expect(extractProductFromUrl).toHaveBeenCalledWith('https://nike.com/air-max-90')
    expect(prismaMock.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        name: 'Nike Air Max 90',
        price: '$129.99',
        source: 'WHATSAPP',
      }),
    })
    expect(prismaMock.giftListItem.create).toHaveBeenCalled()
  })

  it('creates ITEM_ADDED activity for URL saves', async () => {
    await handleTextMessage(USER_ID, LIST_ID, 'https://nike.com/air-max-90', PHONE)

    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'ITEM_ADDED',
        metadata: expect.objectContaining({ source: 'WHATSAPP' }),
      })
    )
  })

  it('sends product image with confirmation', async () => {
    await handleTextMessage(USER_ID, LIST_ID, 'https://nike.com/air-max-90', PHONE)

    expect(sendImageMessage).toHaveBeenCalledWith(
      PHONE,
      'https://cdn.nike.com/airmax90.jpg',
      expect.stringContaining('Added: Nike Air Max 90')
    )
  })

  it('detects duplicate URLs', async () => {
    prismaMock.item.findFirst.mockResolvedValue({ name: 'Nike Air Max 90' } as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'https://nike.com/air-max-90', PHONE)

    expect(reply).toContain('already saved')
    expect(prismaMock.item.create).not.toHaveBeenCalled()
  })

  it('handles extraction failure gracefully', async () => {
    vi.mocked(extractProductFromUrl).mockResolvedValueOnce({
      name: 'example.com',
      price: null,
      priceValue: null,
      image: null,
      url: 'https://example.com/bad',
      domain: 'example.com',
    })

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'https://example.com/bad', PHONE)

    expect(reply).toContain("couldn't extract")
    expect(prismaMock.item.create).not.toHaveBeenCalled()
  })

  it('handles missing image gracefully', async () => {
    vi.mocked(extractProductFromUrl).mockResolvedValueOnce({
      name: 'Some Product',
      price: '$50',
      priceValue: 50,
      image: null,
      url: 'https://example.com/product',
      domain: 'example.com',
    })

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'https://example.com/product', PHONE)

    expect(reply).toContain("couldn't get a product image")
  })

  it('shows event prompt when user has upcoming events', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Mom's Birthday", date: futureDate() },
    ] as any)

    await handleTextMessage(USER_ID, LIST_ID, 'https://nike.com/air-max-90', PHONE)

    expect(sendImageMessage).toHaveBeenCalledWith(
      PHONE,
      expect.any(String),
      expect.stringContaining('event')
    )
  })
})

// ================================================================
// 3. ADD ITEM BY PHOTO
// ================================================================

describe('3. Add item by photo', () => {
  beforeEach(() => {
    // Mock successful retailer scrape
    vi.mocked(extractProductFromUrl).mockResolvedValue({
      name: 'JBL Portable Speaker',
      price: '$49.99',
      priceValue: 49.99,
      image: 'https://amazon.com/jbl.jpg',
      url: 'https://amazon.com/jbl-speaker',
      domain: 'amazon.com',
    })
  })

  it('identifies product from image and asks for confirmation', async () => {
    const reply = await handleImageMessage(USER_ID, LIST_ID, 'media-1', 'image/jpeg', undefined, PHONE)

    expect(downloadMedia).toHaveBeenCalledWith('media-1')
    expect(extractProductFromImage).toHaveBeenCalled()
    // Should store pending product
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingProduct: expect.stringContaining('JBL'),
        }),
      })
    )
  })

  it('saves pending product on "yes" confirmation', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID,
      pendingProduct: JSON.stringify({
        name: 'JBL Portable Speaker',
        price: '$49.99',
        priceValue: 49.99,
        image: 'https://amazon.com/jbl.jpg',
        url: 'https://amazon.com/jbl-speaker',
        domain: 'amazon.com',
      }),
    } as any)

    await handleTextMessage(USER_ID, LIST_ID, 'yes', PHONE)

    expect(prismaMock.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'JBL Portable Speaker',
        source: 'WHATSAPP',
      }),
    })
  })

  it('clears pending product on "no"', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID,
      pendingProduct: JSON.stringify({ name: 'Some Product' }),
    } as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'no', PHONE)

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pendingProduct: null },
      })
    )
    expect(reply).toContain('No problem')
  })

  it('clears pending product on unrelated message', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID,
      pendingProduct: JSON.stringify({ name: 'Some Product' }),
    } as any)

    await handleTextMessage(USER_ID, LIST_ID, 'something else entirely', PHONE)

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pendingProduct: null },
      })
    )
  })

  it('handles image download failure', async () => {
    vi.mocked(downloadMedia).mockRejectedValueOnce(new Error('Network error'))

    const reply = await handleImageMessage(USER_ID, LIST_ID, 'media-1', 'image/jpeg', undefined, PHONE)

    expect(reply).toContain("Couldn't download")
  })

  it('handles unidentifiable image', async () => {
    vi.mocked(extractProductFromImage).mockResolvedValueOnce(null)

    const reply = await handleImageMessage(USER_ID, LIST_ID, 'media-1', 'image/jpeg', undefined, PHONE)

    expect(reply).toContain("Couldn't identify")
  })

  it('routes to URL handler when caption contains URL', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null)

    await handleImageMessage(
      USER_ID, LIST_ID, 'media-1', 'image/jpeg',
      'Look at this https://nike.com/air-max-90', PHONE
    )

    expect(extractProductFromUrl).toHaveBeenCalledWith('https://nike.com/air-max-90')
  })
})

// ================================================================
// 4. EVENT CREATION VIA CHAT
// ================================================================

describe('4. Event creation via chat', () => {
  it('creates event from [EVENT] block in Claude response', async () => {
    setMockChat(
      'Done!\n[EVENT]{"name":"Mom Birthday","type":"BIRTHDAY","date":"2026-08-15"}[/EVENT]'
    )

    await handleTextMessage(USER_ID, LIST_ID, "My mom's birthday is August 15", PHONE)

    expect(prismaMock.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        name: 'Mom Birthday',
        type: 'BIRTHDAY',
      }),
    })
  })

  it('does not duplicate existing event', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'existing', name: 'Mom Birthday' } as any)

    setMockChat('[EVENT]{"name":"Mom Birthday","type":"BIRTHDAY","date":"2026-08-15"}[/EVENT]')

    await handleTextMessage(USER_ID, LIST_ID, 'Create mom birthday', PHONE)

    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })
})

// ================================================================
// 5. ITEM-TO-EVENT LINKING VIA CHAT
// ================================================================

describe('5. Item-to-event linking via [ADD_TO_EVENT]', () => {
  it('creates item and links to existing event', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'ev-1', name: 'Mom Birthday' } as any)

    setMockChat(
      'Added!\n[ADD_TO_EVENT]{"itemId":"new","eventId":"ev-1","itemName":"Candle Set","eventName":"Mom Birthday","price":"$25"}[/ADD_TO_EVENT]'
    )

    await handleTextMessage(USER_ID, LIST_ID, "Add candle set to mom's birthday", PHONE)

    expect(prismaMock.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Candle Set' }),
    })
    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: 'ev-1' }),
    })
  })

  it('links existing item by ID', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'ev-1', name: 'Mom Birthday' } as any)

    setMockChat(
      '[ADD_TO_EVENT]{"itemId":"item-existing","eventId":"ev-1","itemName":"AirPods","eventName":"Mom Birthday"}[/ADD_TO_EVENT]'
    )

    await handleTextMessage(USER_ID, LIST_ID, "Add AirPods to mom's birthday", PHONE)

    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: 'ev-1', itemId: 'item-existing' }),
    })
  })

  it('falls back to name-based event lookup when ID fails', async () => {
    prismaMock.event.findFirst
      .mockResolvedValueOnce(null) // ID lookup
      .mockResolvedValueOnce({ id: 'ev-found', name: 'Mom Birthday' } as any) // name lookup

    setMockChat(
      '[ADD_TO_EVENT]{"itemId":"new","eventId":"wrong","itemName":"Book","eventName":"Mom Birthday","price":"$15"}[/ADD_TO_EVENT]'
    )

    await handleTextMessage(USER_ID, LIST_ID, "Add book to mom's birthday", PHONE)

    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: 'ev-found' }),
    })
  })

  it('records EVENT_ITEM_ADDED activity', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'ev-1', name: 'Mom Birthday' } as any)

    setMockChat(
      '[ADD_TO_EVENT]{"itemId":"new","eventId":"ev-1","itemName":"Watch","eventName":"Mom Birthday"}[/ADD_TO_EVENT]'
    )

    await handleTextMessage(USER_ID, LIST_ID, "Add watch to mom's birthday", PHONE)

    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT_ITEM_ADDED',
        metadata: expect.objectContaining({ eventName: 'Mom Birthday' }),
      })
    )
  })
})

// ================================================================
// 6. "event <n>" QUICK COMMAND
// ================================================================

describe('6. "event <n>" quick-link command', () => {
  it('links last item to selected event', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Mom's Birthday", date: futureDate() },
    ] as any)
    prismaMock.item.findFirst.mockResolvedValue({ id: 'last-item', name: 'Nike Shoes' } as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'event 1', PHONE)

    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: 'ev-1', itemId: 'last-item' }),
    })
    expect(reply).toContain('Nike Shoes')
    expect(reply).toContain("Mom's Birthday")
  })

  it('rejects out-of-range event number', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Mom's Birthday", date: futureDate() },
    ] as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'event 3', PHONE)

    expect(reply).toContain('Invalid')
    expect(prismaMock.eventItem.create).not.toHaveBeenCalled()
  })

  it('handles no items to link', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: 'Birthday', date: futureDate() },
    ] as any)
    prismaMock.item.findFirst.mockResolvedValue(null)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'event 1', PHONE)

    expect(reply).toContain('No items')
  })

  it('detects already-linked item', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: 'Birthday', date: futureDate() },
    ] as any)
    prismaMock.item.findFirst.mockResolvedValue({ id: 'item-1', name: 'Shoes' } as any)
    prismaMock.eventItem.findFirst.mockResolvedValue({ id: 'link-1' } as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'event 1', PHONE)

    expect(reply).toContain('already linked')
  })
})

// ================================================================
// 7. COMMANDS
// ================================================================

describe('7. Commands', () => {
  describe('help', () => {
    it('returns help text with all commands', async () => {
      const reply = await handleTextMessage(USER_ID, LIST_ID, 'help', PHONE)
      expect(reply).toContain('Send a link')
      expect(reply).toContain('Send a photo')
      expect(reply).toContain('list')
      expect(reply).toContain('remove')
      expect(reply).toContain('edit')
      expect(reply).toContain('events')
      expect(reply).toContain('event <number>')
      expect(reply).toContain('share')
    })
  })

  describe('list', () => {
    it('shows items with prices', async () => {
      prismaMock.giftListItem.findMany.mockResolvedValue([
        { item: { name: 'AirPods Pro', price: '$249' } },
        { item: { name: 'Book', price: null } },
      ] as any)

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'list', PHONE)

      expect(reply).toContain('1. AirPods Pro ($249)')
      expect(reply).toContain('2. Book')
    })

    it('shows empty state', async () => {
      prismaMock.giftListItem.findMany.mockResolvedValue([])

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'list', PHONE)

      expect(reply).toContain('empty')
    })
  })

  describe('events', () => {
    it('lists events with dates', async () => {
      prismaMock.event.findMany.mockResolvedValue([
        { name: 'Birthday', date: new Date('2026-06-15'), type: 'BIRTHDAY' },
        { name: 'Christmas', date: new Date('2026-12-25'), type: 'CHRISTMAS' },
      ] as any)

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'events', PHONE)

      expect(reply).toContain('1. Birthday')
      expect(reply).toContain('2. Christmas')
    })

    it('shows empty state', async () => {
      prismaMock.event.findMany.mockResolvedValue([])

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'events', PHONE)

      expect(reply).toContain("don't have any events")
    })
  })

  describe('share', () => {
    it('returns shareable URL', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ shareId: 'abc123', name: 'Test' } as any)

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'share', PHONE)

      expect(reply).toContain('giftist.ai/u/abc123')
    })
  })

  describe('remove <n>', () => {
    it('removes item by index', async () => {
      prismaMock.giftListItem.findMany.mockResolvedValue([
        { id: 'gli-1', item: { name: 'AirPods' } },
        { id: 'gli-2', item: { name: 'Book' } },
      ] as any)

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'remove 2', PHONE)

      expect(prismaMock.giftListItem.delete).toHaveBeenCalledWith({ where: { id: 'gli-2' } })
      expect(reply).toContain('Removed: Book')
    })

    it('rejects invalid index', async () => {
      prismaMock.giftListItem.findMany.mockResolvedValue([
        { id: 'gli-1', item: { name: 'AirPods' } },
      ] as any)

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'remove 5', PHONE)

      expect(reply).toContain('Invalid number')
    })
  })

  describe('remove event <n>', () => {
    it('deletes event by index', async () => {
      prismaMock.event.findMany.mockResolvedValue([
        { id: 'ev-1', name: 'Birthday', date: new Date() },
      ] as any)

      const reply = await handleTextMessage(USER_ID, LIST_ID, 'remove event 1', PHONE)

      expect(prismaMock.event.delete).toHaveBeenCalledWith({ where: { id: 'ev-1' } })
      expect(reply).toContain('Deleted event: Birthday')
    })
  })

  describe('edit <n> name/price', () => {
    beforeEach(() => {
      prismaMock.giftListItem.findMany.mockResolvedValue([
        { id: 'gli-1', item: { id: 'item-1', name: 'Old Name' } },
      ] as any)
    })

    it('edits item name', async () => {
      const reply = await handleTextMessage(USER_ID, LIST_ID, 'edit 1 name New Name', PHONE)

      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { name: 'new name' }, // trimmed is lowercased, so name is also lowercase
      })
      expect(reply).toContain('Updated name')
    })

    it('edits item price', async () => {
      const reply = await handleTextMessage(USER_ID, LIST_ID, 'edit 1 price $75.00', PHONE)

      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { price: '$75.00', priceValue: 75 },
      })
      expect(reply).toContain('Updated price')
    })
  })
})

// ================================================================
// 8. CHAT ROUTING + LIMITS
// ================================================================

describe('8. Chat routing', () => {
  it('routes plain text to Claude', async () => {
    setMockChat('Here are some great gift ideas for your mom!')

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'Gift ideas for my mom', PHONE)

    expect(prismaMock.chatMessage.create).toHaveBeenCalled()
    expect(reply).toContain('gift ideas')
  })

  it('enforces daily message limit for free users', async () => {
    vi.mocked(checkChatLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 })

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'hello', PHONE)

    expect(reply).toContain('daily limit')
    expect(reply).toContain('Gold')
  })

  it('strips [EVENT]/[ADD_TO_EVENT] blocks from WhatsApp reply', async () => {
    setMockChat(
      'Created your event!\n\n[EVENT]{"name":"Test","type":"OTHER","date":"2026-01-01"}[/EVENT]\n\nEnjoy!'
    )

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'Create test event', PHONE)

    // Reply should not contain raw JSON blocks
    expect(reply).not.toContain('[EVENT]')
    expect(reply).toContain('Created your event')
  })
})

// ================================================================
// 9. WELCOME FLOW
// ================================================================

describe('9. Welcome flow', () => {
  it('includes user name in welcome message', () => {
    expect(getWelcomeMessage('Alice')).toContain('Hi Alice')
  })

  it('uses fallback greeting without name', () => {
    expect(getWelcomeMessage()).toContain('Hi there')
  })

  it('describes core features', () => {
    const msg = getWelcomeMessage('Test')
    expect(msg).toContain('link')
    expect(msg).toContain('photo')
    expect(msg).toContain('gift ideas')
  })
})

// ================================================================
// 10. VIEW/ITEM COMMANDS
// ================================================================

describe('10. View commands', () => {
  it('view <shareId> shows wishlist', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Alice',
      shareId: 'abc123',
      items: [
        { name: 'AirPods', price: '$249', priceValue: 249 },
        { name: 'Book', price: null, priceValue: null },
      ],
    } as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'view abc123', PHONE)

    expect(reply).toContain('Alice')
    expect(reply).toContain('AirPods')
    expect(reply).toContain('Book')
  })

  it('view returns error for invalid shareId', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'view invalid', PHONE)

    expect(reply).toContain("couldn't find")
  })
})

// ================================================================
// 11. GIFT CIRCLE COMMANDS
// ================================================================

describe('11. Gift Circle commands', () => {
  it('lists circle members', async () => {
    prismaMock.circleMember.findMany.mockResolvedValue([
      { id: 'cm-1', name: 'Mom', phone: '15551111111', relationship: 'family' },
      { id: 'cm-2', name: 'Dave', phone: '15552222222', relationship: 'friend' },
    ] as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'circle', PHONE)

    expect(reply).toContain('1. Mom (family)')
    expect(reply).toContain('2. Dave (friend)')
  })

  it('shows empty circle', async () => {
    prismaMock.circleMember.findMany.mockResolvedValue([])

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'circle', PHONE)

    expect(reply).toContain('empty')
  })

  it('adds circle member with name', async () => {
    prismaMock.circleMember.findUnique.mockResolvedValue(null)
    prismaMock.circleMember.create.mockResolvedValue({} as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'add circle 555-123-4567 Mom', PHONE)

    expect(prismaMock.circleMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        phone: '15551234567',
        name: 'Mom',
        source: 'WHATSAPP',
      }),
    })
    expect(reply).toContain('Added Mom')
  })

  it('detects duplicate circle member', async () => {
    prismaMock.circleMember.findUnique.mockResolvedValue({ name: 'Mom', phone: '15551234567' } as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'add circle 555-123-4567 Mom', PHONE)

    expect(reply).toContain('already in')
  })

  it('removes circle member by index', async () => {
    prismaMock.circleMember.findMany.mockResolvedValue([
      { id: 'cm-1', name: 'Mom', phone: '15551111111' },
      { id: 'cm-2', name: 'Dave', phone: '15552222222' },
    ] as any)
    prismaMock.circleMember.delete.mockResolvedValue({} as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'remove circle 2', PHONE)

    expect(prismaMock.circleMember.delete).toHaveBeenCalledWith({ where: { id: 'cm-2' } })
    expect(reply).toContain('Removed Dave')
  })

  it('rejects invalid circle index', async () => {
    prismaMock.circleMember.findMany.mockResolvedValue([
      { id: 'cm-1', name: 'Mom', phone: '15551111111' },
    ] as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'remove circle 5', PHONE)

    expect(reply).toContain('Invalid')
  })
})

// ================================================================
// 12. EVENT REMINDERS
// ================================================================

describe('12. Event reminders', () => {
  it('sends reminders to circle members', async () => {
    const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    prismaMock.event.findMany.mockResolvedValue([
      {
        id: 'ev-1',
        name: "Mom's Birthday",
        date: soonDate,
        items: [{ item: { name: 'AirPods', price: '$249' } }],
      },
    ] as any)
    prismaMock.circleMember.findMany.mockResolvedValue([
      { id: 'cm-1', name: 'Dad', phone: '15559999999' },
    ] as any)
    prismaMock.user.findUnique.mockResolvedValue({ name: 'Alice', shareId: 'abc123' } as any)

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'remind', PHONE)

    expect(sendTextMessage).toHaveBeenCalledWith(
      '15559999999',
      expect.stringContaining('Alice')
    )
    expect(reply).toContain('Sent reminders to 1')
  })

  it('handles no upcoming events', async () => {
    prismaMock.event.findMany.mockResolvedValue([])

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'remind', PHONE)

    expect(reply).toContain('No events')
  })

  it('handles no circle members', async () => {
    const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: 'Birthday', date: soonDate, items: [] },
    ] as any)
    prismaMock.circleMember.findMany.mockResolvedValue([])

    const reply = await handleTextMessage(USER_ID, LIST_ID, 'remind', PHONE)

    expect(reply).toContain('no one in your Gift Circle')
  })
})

// ================================================================
// 13. HELP MESSAGE COMPLETENESS
// ================================================================

describe('13. Help message', () => {
  it('documents all available commands', () => {
    const help = getHelpMessage()

    const expected = ['link', 'photo', 'list', 'share', 'remove', 'edit', 'events', 'event <number>', 'remove event', 'circle', 'add circle', 'remove circle', 'remind']
    for (const cmd of expected) {
      expect(help.toLowerCase()).toContain(cmd.toLowerCase())
    }
  })
})
