import { vi } from 'vitest'

export const whatsappMocks = {
  sendTextMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_test' }] }),
  sendImageMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_test' }] }),
  downloadMedia: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
  markAsRead: vi.fn().mockResolvedValue({}),
  normalizePhone: vi.fn((phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length >= 10) return digits
    if (digits.length === 10) return '1' + digits
    return digits
  }),
}

vi.mock('@/lib/whatsapp', () => whatsappMocks)
