import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma'
import { whatsappMocks } from '@/test/mocks/whatsapp'

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'email-1' }),
}))

// Must import after mocks are set up
import { smartWhatsAppSend, notify, notifyWelcome, notifyItemAdded, notifyContributionReceived } from './notifications'
import { sendEmail } from '@/lib/email'

const { sendTextMessage, sendTemplateMessage } = whatsappMocks

describe('smartWhatsAppSend', () => {
  beforeEach(() => {
    resetPrismaMock()
    vi.clearAllMocks()
  })

  it('uses text message when inbound message exists within 24h', async () => {
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue({
      id: 'msg-1',
      waMessageId: 'wa-1',
      phone: '15551234567',
      type: 'text',
      content: 'hello',
      itemId: null,
      status: 'RECEIVED',
      error: null,
      createdAt: new Date(),
      processedAt: null,
    })

    await smartWhatsAppSend('15551234567', 'Hello!', 'welcome_message', ['there'])

    expect(sendTextMessage).toHaveBeenCalledWith('15551234567', 'Hello!')
    expect(sendTemplateMessage).not.toHaveBeenCalled()
  })

  it('falls back to template when no recent inbound message', async () => {
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)

    await smartWhatsAppSend('15551234567', 'Hello!', 'welcome_message', ['there'])

    expect(sendTemplateMessage).toHaveBeenCalledWith('15551234567', 'welcome_message', ['there'])
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('falls back to template when inbound message is >24h old', async () => {
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)

    await smartWhatsAppSend('15551234567', 'Hello!', 'welcome_message', ['there'])

    expect(sendTemplateMessage).toHaveBeenCalledWith('15551234567', 'welcome_message', ['there'])
  })

  it('handles missing phone gracefully', async () => {
    await smartWhatsAppSend('', 'Hello!', 'welcome_message', ['there'])

    expect(sendTextMessage).not.toHaveBeenCalled()
    expect(sendTemplateMessage).not.toHaveBeenCalled()
  })

  it('handles WhatsApp API failure gracefully', async () => {
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)
    sendTemplateMessage.mockRejectedValueOnce(new Error('API error'))

    await expect(
      smartWhatsAppSend('15551234567', 'Hello!', 'welcome_message', ['there'])
    ).rejects.toThrow('API error')
  })

  it('handles missing template gracefully', async () => {
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)

    await smartWhatsAppSend('15551234567', 'Hello!', '', [])

    expect(sendTemplateMessage).toHaveBeenCalledWith('15551234567', '', [])
  })
})

describe('notify', () => {
  beforeEach(() => {
    resetPrismaMock()
    vi.clearAllMocks()
  })

  it('creates in-app Notification record', async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'ITEM_ADDED',
      title: 'Item added',
      body: 'Test item added',
      metadata: null,
      read: false,
      channel: 'IN_APP',
      createdAt: new Date(),
    })

    await notify({
      userId: 'user-1',
      type: 'ITEM_ADDED',
      title: 'Item added',
      body: 'Test item added',
    })

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'ITEM_ADDED',
        title: 'Item added',
        body: 'Test item added',
        channel: 'IN_APP',
      }),
    })
  })

  it('sends email when email config provided', async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'WELCOME',
      title: 'Welcome',
      body: 'Welcome!',
      metadata: null,
      read: false,
      channel: 'EMAIL',
      createdAt: new Date(),
    })

    await notify({
      userId: 'user-1',
      type: 'WELCOME',
      title: 'Welcome',
      body: 'Welcome!',
      email: { to: 'test@example.com', subject: 'Welcome', html: '<p>Hi</p>' },
    })

    expect(sendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Welcome',
      html: '<p>Hi</p>',
    })
  })

  it('sends WhatsApp when whatsapp config provided', async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'WELCOME',
      title: 'Welcome',
      body: 'Welcome!',
      metadata: null,
      read: false,
      channel: 'WHATSAPP',
      createdAt: new Date(),
    })
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)

    await notify({
      userId: 'user-1',
      type: 'WELCOME',
      title: 'Welcome',
      body: 'Welcome!',
      whatsapp: {
        phone: '15551234567',
        text: 'Welcome!',
        template: 'welcome_message',
        templateParams: ['there'],
      },
    })

    // Give the fire-and-forget a tick
    await new Promise(r => setTimeout(r, 50))
    expect(sendTemplateMessage).toHaveBeenCalled()
  })

  it('sends both email + WhatsApp when both provided', async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'WELCOME',
      title: 'Welcome',
      body: 'Welcome!',
      metadata: null,
      read: false,
      channel: 'ALL',
      createdAt: new Date(),
    })
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)

    await notify({
      userId: 'user-1',
      type: 'WELCOME',
      title: 'Welcome',
      body: 'Welcome!',
      email: { to: 'test@example.com', subject: 'Welcome', html: '<p>Hi</p>' },
      whatsapp: {
        phone: '15551234567',
        text: 'Welcome!',
        template: 'welcome_message',
        templateParams: ['there'],
      },
    })

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'ALL' }),
    })
    expect(sendEmail).toHaveBeenCalled()
  })

  it("doesn't block on send failures (fire-and-forget)", async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'WELCOME',
      title: 'Welcome',
      body: 'Welcome!',
      metadata: null,
      read: false,
      channel: 'EMAIL',
      createdAt: new Date(),
    })
    ;(sendEmail as any).mockRejectedValueOnce(new Error('Email fail'))

    // Should not throw even though email fails
    await expect(
      notify({
        userId: 'user-1',
        type: 'WELCOME',
        title: 'Welcome',
        body: 'Welcome!',
        email: { to: 'test@example.com', subject: 'Welcome', html: '<p>Hi</p>' },
      })
    ).resolves.toBeUndefined()
  })
})

describe('per-action notification helpers', () => {
  beforeEach(() => {
    resetPrismaMock()
    vi.clearAllMocks()
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'ITEM_ADDED',
      title: 'Test',
      body: 'Test',
      metadata: null,
      read: false,
      channel: 'IN_APP',
      createdAt: new Date(),
    })
  })

  it('notifyWelcome creates notification with email and whatsapp', async () => {
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)

    await notifyWelcome('user-1', 'test@example.com', '15551234567', 'Test User')

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'WELCOME',
        channel: 'ALL',
      }),
    })
    expect(sendEmail).toHaveBeenCalled()
  })

  it('notifyWelcome works with only email', async () => {
    await notifyWelcome('user-1', 'test@example.com', null, 'Test User')

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'WELCOME',
        channel: 'EMAIL',
      }),
    })
  })

  it('notifyWelcome works with only phone', async () => {
    prismaMock.whatsAppMessage.findFirst.mockResolvedValue(null)

    await notifyWelcome('user-1', null, '15551234567', 'Test User')

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'WELCOME',
        channel: 'WHATSAPP',
      }),
    })
  })

  it('notifyItemAdded creates in-app notification with metadata', async () => {
    await notifyItemAdded('user-1', 'Cool Gadget', 'item-1')

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'ITEM_ADDED',
        title: 'Item added',
        channel: 'IN_APP',
        metadata: JSON.stringify({ itemId: 'item-1' }),
      }),
    })
  })

  it('notifyContributionReceived creates notification with correct data', async () => {
    await notifyContributionReceived(
      'user-1',
      'Jane',
      25.0,
      'Cool Gadget',
      { itemId: 'item-1', contributionId: 'contrib-1' }
    )

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'CONTRIBUTION_RECEIVED',
        title: 'You received a contribution!',
        body: 'Jane contributed $25.00 toward "Cool Gadget".',
      }),
    })
  })
})
