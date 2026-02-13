import { describe, it, expect } from 'vitest'
import { normalizePhone } from './whatsapp'

describe('normalizePhone', () => {
  it('strips non-digit characters', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('15551234567')
  })

  it('keeps 11-digit US number as-is', () => {
    expect(normalizePhone('15551234567')).toBe('15551234567')
  })

  it('keeps international numbers (12+ digits)', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210')
  })

  it('handles short numbers', () => {
    expect(normalizePhone('12345')).toBe('12345')
  })

  it('returns digits only from formatted number', () => {
    expect(normalizePhone('+44 7911 123456')).toBe('447911123456')
  })
})
