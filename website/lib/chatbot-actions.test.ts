/**
 * Chatbot Actions Integration Tests
 *
 * Tests that chatbot actions (WhatsApp + Web) correctly create and update
 * events, items, and event-item links in the database — and that those
 * changes are reflected on the site (feed, events page, activity feed).
 *
 * Test categories (add more below as needed):
 * 1. Event creation via chatbot
 * 2. Item creation + event linking via chatbot
 * 3. WhatsApp "event <n>" command
 * 4. Web chatbot event/item syncing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../test/mocks/prisma'

// ---------- Mocks ----------

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
  extractProductFromImage: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/whatsapp', () => ({
  sendTextMessage: vi.fn().mockResolvedValue({}),
  sendImageMessage: vi.fn().mockResolvedValue({}),
  downloadMedia: vi.fn().mockResolvedValue(Buffer.from('fake')),
}))

vi.mock('@/lib/chat-context', () => ({
  buildChatContext: vi.fn().mockResolvedValue('System prompt'),
  checkChatLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
}))

vi.mock('@/lib/activity', () => ({
  createActivity: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/enrich-item', () => ({
  enrichItem: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/platform-fee', () => ({
  calculateGoalAmount: vi.fn().mockReturnValue({ goalAmount: 35, feeRate: 0, feeAmount: 0 }),
}))

vi.mock('@/lib/parse-chat-content', async () => {
  const actual = await vi.importActual<typeof import('@/lib/parse-chat-content')>('@/lib/parse-chat-content')
  return {
    ...actual,
    // Use real parseChatContent + stripSpecialBlocks so we test actual parsing
  }
})

vi.mock('@anthropic-ai/sdk', () => {
  let mockResponse = 'Hello!'
  return {
    default: class MockAnthropic {
      static __setMockResponse(text: string) { mockResponse = text }
      messages = {
        create: vi.fn().mockImplementation(() =>
          Promise.resolve({
            content: [{ type: 'text', text: mockResponse }],
            usage: { input_tokens: 100, output_tokens: 50 },
          })
        ),
      }
    },
  }
})

vi.mock('@/lib/api-logger', () => ({
  logApiCall: vi.fn().mockResolvedValue({}),
  logError: vi.fn().mockResolvedValue({}),
}))

import { handleTextMessage } from './whatsapp-handlers'
import { parseChatContent } from './parse-chat-content'
import { createActivity } from './activity'
import Anthropic from '@anthropic-ai/sdk'

const setMockResponse = (Anthropic as any).__setMockResponse

// ---------- Helpers ----------

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.item.create.mockResolvedValue({ id: 'item-new', name: 'Test' } as any)
  prismaMock.item.findFirst.mockResolvedValue(null)
  prismaMock.giftListItem.create.mockResolvedValue({} as any)
  prismaMock.chatMessage.create.mockResolvedValue({} as any)
  prismaMock.chatMessage.findMany.mockResolvedValue([])
  prismaMock.chatMessage.count.mockResolvedValue(1)
  prismaMock.event.findMany.mockResolvedValue([])
  prismaMock.event.findFirst.mockResolvedValue(null)
  prismaMock.event.create.mockResolvedValue({ id: 'event-new', name: 'Test Event' } as any)
  prismaMock.eventItem.create.mockResolvedValue({} as any)
  prismaMock.eventItem.deleteMany.mockResolvedValue({ count: 0 } as any)
  prismaMock.eventItem.findFirst.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', pendingProduct: null } as any)
})

// ================================================================
// 1. EVENT CREATION VIA CHATBOT
// ================================================================

describe('Event creation via chatbot', () => {
  it('WhatsApp: creates event when Claude responds with [EVENT] block', async () => {
    setMockResponse(
      'I\'ve created a birthday event for your sister!\n\n' +
      '[EVENT]{"name":"Sarah\'s Birthday","type":"BIRTHDAY","date":"2026-06-15"}[/EVENT]'
    )

    await handleTextMessage('user-1', 'list-1', "My sister Sarah's birthday is June 15", '15551234567')

    expect(prismaMock.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        name: "Sarah's Birthday",
        type: 'BIRTHDAY',
        date: expect.any(Date),
        isPublic: true,
      }),
    })
  })

  it('WhatsApp: does NOT duplicate event if name already exists', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'existing-event', name: "Sarah's Birthday" } as any)

    setMockResponse(
      'Sure!\n\n[EVENT]{"name":"Sarah\'s Birthday","type":"BIRTHDAY","date":"2026-06-15"}[/EVENT]'
    )

    await handleTextMessage('user-1', 'list-1', "Create Sarah's birthday event", '15551234567')

    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })

  it('WhatsApp: creates multiple events from a single response', async () => {
    setMockResponse(
      'Created both events!\n\n' +
      '[EVENT]{"name":"Mom Birthday","type":"BIRTHDAY","date":"2026-03-10"}[/EVENT]\n' +
      '[EVENT]{"name":"Easter","type":"HOLIDAY","date":"2026-04-05"}[/EVENT]'
    )

    // First call: no existing event
    prismaMock.event.findFirst.mockResolvedValue(null)

    await handleTextMessage('user-1', 'list-1', 'Create events for Mom birthday March 10 and Easter April 5', '15551234567')

    expect(prismaMock.event.create).toHaveBeenCalledTimes(2)
  })
})

// ================================================================
// 2. ITEM CREATION + EVENT LINKING VIA CHATBOT
// ================================================================

describe('Item added to event via chatbot', () => {
  it('WhatsApp: creates item and links to existing event via [ADD_TO_EVENT]', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'event-123', name: "Sarah's Birthday" } as any)
    prismaMock.item.create.mockResolvedValue({ id: 'item-456', name: 'Candle Set' } as any)

    setMockResponse(
      'Great choice!\n\n' +
      '[ADD_TO_EVENT]{"itemId":"new","eventId":"event-123","itemName":"Candle Set","eventName":"Sarah\'s Birthday","price":"$25"}[/ADD_TO_EVENT]'
    )

    const reply = await handleTextMessage('user-1', 'list-1', "Add a candle set to Sarah's birthday", '15551234567')

    // Item should be created
    expect(prismaMock.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        name: 'Candle Set',
        source: 'WHATSAPP',
      }),
    })

    // EventItem link should be created
    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'event-123',
      }),
    })

    // Activity should be recorded
    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT_ITEM_ADDED',
        metadata: expect.objectContaining({
          eventName: "Sarah's Birthday",
        }),
      })
    )

    // Reply should confirm the action
    expect(reply).toContain('Candle Set')
    expect(reply).toContain("Sarah's Birthday")
  })

  it('WhatsApp: links existing item (by ID) to event', async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: 'event-123', name: "Sarah's Birthday" } as any)

    setMockResponse(
      'Linked!\n\n' +
      '[ADD_TO_EVENT]{"itemId":"item-existing","eventId":"event-123","itemName":"AirPods","eventName":"Sarah\'s Birthday"}[/ADD_TO_EVENT]'
    )

    await handleTextMessage('user-1', 'list-1', "Add my AirPods to Sarah's birthday", '15551234567')

    // Should NOT create a new item when itemId is a real ID
    // Should create EventItem link
    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'event-123',
        itemId: 'item-existing',
      }),
    })
  })

  it('WhatsApp: resolves event by name when ID does not match', async () => {
    // First call with ID fails, second call with name succeeds
    prismaMock.event.findFirst
      .mockResolvedValueOnce(null) // ID lookup fails
      .mockResolvedValueOnce({ id: 'event-found', name: "Sarah's Birthday" } as any) // name lookup succeeds

    setMockResponse(
      '[ADD_TO_EVENT]{"itemId":"new","eventId":"wrong-id","itemName":"Book","eventName":"Sarah\'s Birthday","price":"$15"}[/ADD_TO_EVENT]'
    )

    await handleTextMessage('user-1', 'list-1', "Add a book to Sarah's birthday", '15551234567')

    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'event-found',
      }),
    })
  })

  it('WhatsApp: creates event AND adds item in same response', async () => {
    // Event does not exist yet
    prismaMock.event.findFirst.mockResolvedValue(null)
    prismaMock.event.create.mockResolvedValue({ id: 'event-new', name: "Dad's Birthday" } as any)

    setMockResponse(
      'Created the event and added the gift!\n\n' +
      '[EVENT]{"name":"Dad\'s Birthday","type":"BIRTHDAY","date":"2026-07-20"}[/EVENT]\n' +
      '[ADD_TO_EVENT]{"itemId":"new","eventId":"event-new","itemName":"Watch","eventName":"Dad\'s Birthday","price":"$150"}[/ADD_TO_EVENT]'
    )

    // After event creation, findFirst should find it
    prismaMock.event.findFirst
      .mockResolvedValueOnce(null)  // dedup check for [EVENT] — does not exist
      .mockResolvedValueOnce(null)  // [ADD_TO_EVENT] ID lookup
      .mockResolvedValueOnce({ id: 'event-new', name: "Dad's Birthday" } as any) // [ADD_TO_EVENT] name lookup

    await handleTextMessage('user-1', 'list-1', "Create Dad's birthday July 20 and add a watch", '15551234567')

    // Event created
    expect(prismaMock.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Dad's Birthday",
        type: 'BIRTHDAY',
      }),
    })

    // Item created and linked
    expect(prismaMock.item.create).toHaveBeenCalled()
    expect(prismaMock.eventItem.create).toHaveBeenCalled()
  })
})

// ================================================================
// 3. WHATSAPP "event <n>" COMMAND
// ================================================================

describe('WhatsApp "event <n>" command', () => {
  it('links last-added item to selected event', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Sarah's Birthday", date: futureDate },
      { id: 'ev-2', name: 'Christmas', date: futureDate },
    ] as any)
    prismaMock.item.findFirst.mockResolvedValue({ id: 'last-item', name: 'Candles' } as any)
    prismaMock.eventItem.findFirst.mockResolvedValue(null) // not already linked

    const reply = await handleTextMessage('user-1', 'list-1', 'event 1', '15551234567')

    expect(prismaMock.eventItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'ev-1',
        itemId: 'last-item',
      }),
    })
    expect(reply).toContain('Candles')
    expect(reply).toContain("Sarah's Birthday")
  })

  it('rejects invalid event number', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Sarah's Birthday", date: new Date(Date.now() + 30 * 86400000) },
    ] as any)

    const reply = await handleTextMessage('user-1', 'list-1', 'event 5', '15551234567')

    expect(reply).toContain('Invalid event number')
    expect(prismaMock.eventItem.create).not.toHaveBeenCalled()
  })

  it('returns message when no items exist', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Sarah's Birthday", date: new Date(Date.now() + 30 * 86400000) },
    ] as any)
    prismaMock.item.findFirst.mockResolvedValue(null) // no items

    const reply = await handleTextMessage('user-1', 'list-1', 'event 1', '15551234567')

    expect(reply).toContain('No items')
    expect(prismaMock.eventItem.create).not.toHaveBeenCalled()
  })

  it('detects already-linked item', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Sarah's Birthday", date: new Date(Date.now() + 30 * 86400000) },
    ] as any)
    prismaMock.item.findFirst.mockResolvedValue({ id: 'last-item', name: 'Candles' } as any)
    prismaMock.eventItem.findFirst.mockResolvedValue({ id: 'existing-link' } as any) // already linked

    const reply = await handleTextMessage('user-1', 'list-1', 'event 1', '15551234567')

    expect(reply).toContain('already linked')
    expect(prismaMock.eventItem.create).not.toHaveBeenCalled()
  })
})

// ================================================================
// 4. EVENT PROMPT AFTER ADDING ITEM
// ================================================================

describe('Event prompt shown after adding item', () => {
  it('WhatsApp: URL-added item shows event linking prompt', async () => {
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    prismaMock.event.findMany.mockResolvedValue([
      { id: 'ev-1', name: "Sarah's Birthday", date: futureDate },
    ] as any)
    prismaMock.item.findFirst.mockResolvedValue(null) // no duplicate
    prismaMock.item.count.mockResolvedValue(1)

    const reply = await handleTextMessage('user-1', 'list-1', 'https://example.com/product', '15551234567')

    // Should include event prompt in reply (either via sendImageMessage or text)
    // The sendImageMessage mock was called, so reply is '' — check mock call args instead
    const { sendImageMessage } = await import('@/lib/whatsapp')
    if (reply === '') {
      // Image was sent — check the caption
      expect(sendImageMessage).toHaveBeenCalledWith(
        '15551234567',
        expect.any(String),
        expect.stringContaining('event')
      )
    } else {
      expect(reply).toContain('event')
    }
  })
})

// ================================================================
// 5. WEB CHATBOT EVENT/ITEM SYNCING (KNOWN GAP)
// ================================================================

describe('Web chatbot event/item syncing', () => {
  it('parseChatContent correctly extracts [EVENT] blocks', () => {
    const content = 'Created!\n\n[EVENT]{"name":"Birthday","type":"BIRTHDAY","date":"2026-05-01"}[/EVENT]'
    const segments = parseChatContent(content)

    const eventSeg = segments.find((s) => s.type === 'event')
    expect(eventSeg).toBeDefined()
    expect((eventSeg as any).data.name).toBe('Birthday')
    expect((eventSeg as any).data.type).toBe('BIRTHDAY')
  })

  it('parseChatContent correctly extracts [ADD_TO_EVENT] blocks', () => {
    const content = '[ADD_TO_EVENT]{"itemId":"new","eventId":"ev-1","itemName":"Watch","eventName":"Birthday","price":"$50"}[/ADD_TO_EVENT]'
    const segments = parseChatContent(content)

    const ateSeg = segments.find((s) => s.type === 'add_to_event')
    expect(ateSeg).toBeDefined()
    expect((ateSeg as any).data.itemName).toBe('Watch')
    expect((ateSeg as any).data.eventName).toBe('Birthday')
  })

  it('parseChatContent extracts mixed blocks in correct order', () => {
    const content =
      'Here you go!\n\n' +
      '[EVENT]{"name":"Wedding","type":"WEDDING","date":"2026-09-01"}[/EVENT]\n' +
      '[ADD_TO_EVENT]{"itemId":"new","eventId":"ev-1","itemName":"Vase","eventName":"Wedding"}[/ADD_TO_EVENT]\n' +
      'Enjoy!'

    const segments = parseChatContent(content)

    expect(segments[0].type).toBe('text')
    expect(segments[1].type).toBe('event')
    expect(segments[2].type).toBe('add_to_event')
    expect(segments[3].type).toBe('text')
  })

  // NOTE: The web chat route (/api/chat/route.ts) currently does NOT
  // process [EVENT] or [ADD_TO_EVENT] blocks server-side. It only
  // streams text to the client. This means events/items mentioned by
  // the web concierge are rendered in the UI but never persisted.
  //
  // TODO: Add server-side block processing to /api/chat/route.ts
  // (same logic as whatsapp-handlers.ts lines 663-762) so that
  // web chatbot actions are reflected in the database.
  it.todo('Web chat route processes [EVENT] blocks and creates events in DB')
  it.todo('Web chat route processes [ADD_TO_EVENT] blocks and links items to events in DB')
})

// ================================================================
// 6. FEED/SITE REFLECTS CHATBOT ACTIONS
// ================================================================

describe('Site reflects chatbot actions', () => {
  // These test that the API endpoints used by the feed page return
  // items and events created by chatbot actions.

  it.todo('GET /api/events returns events created via WhatsApp chatbot')
  it.todo('GET /api/feed returns items created via WhatsApp chatbot with eventItems populated')
  it.todo('GET /api/activity returns EVENT_ITEM_ADDED activities from chatbot linking')
  it.todo('GET /api/events/[id] includes items added via chatbot')
})
