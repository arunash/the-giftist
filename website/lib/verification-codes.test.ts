import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must import fresh module for each test to reset the codes Map
let generateCode: typeof import('./verification-codes').generateCode
let verifyCode: typeof import('./verification-codes').verifyCode

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  const mod = await import('./verification-codes')
  generateCode = mod.generateCode
  verifyCode = mod.verifyCode
})

import { afterEach } from 'vitest'
afterEach(() => {
  vi.useRealTimers()
})

describe('generateCode', () => {
  it('generates a 6-digit code', () => {
    const result = generateCode('15551234567')
    expect(result.code).toBeDefined()
    expect(result.code).toHaveLength(6)
    expect(Number(result.code)).toBeGreaterThanOrEqual(100000)
  })

  it('rate limits within 60 seconds', () => {
    generateCode('15551234567')
    const result = generateCode('15551234567')
    expect(result.error).toContain('60 seconds')
    expect(result.code).toBeUndefined()
  })

  it('allows new code after rate limit window', () => {
    generateCode('15551234567')
    vi.advanceTimersByTime(61 * 1000) // 61 seconds
    const result = generateCode('15551234567')
    expect(result.code).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  it('generates different codes for different phones', () => {
    const r1 = generateCode('15551234567')
    const r2 = generateCode('15559876543')
    expect(r1.code).toBeDefined()
    expect(r2.code).toBeDefined()
  })
})

describe('verifyCode', () => {
  it('verifies correct code', () => {
    const { code } = generateCode('15551234567')
    expect(verifyCode('15551234567', code!)).toBe(true)
  })

  it('rejects incorrect code', () => {
    generateCode('15551234567')
    expect(verifyCode('15551234567', '000000')).toBe(false)
  })

  it('rejects after max attempts (3)', () => {
    const { code } = generateCode('15551234567')
    verifyCode('15551234567', '000001')
    verifyCode('15551234567', '000002')
    verifyCode('15551234567', '000003')
    // 4th attempt: exceeds MAX_ATTEMPTS, code deleted
    expect(verifyCode('15551234567', code!)).toBe(false)
  })

  it('rejects expired code', () => {
    const { code } = generateCode('15551234567')
    vi.advanceTimersByTime(6 * 60 * 1000) // 6 minutes (past 5-min TTL)
    expect(verifyCode('15551234567', code!)).toBe(false)
  })

  it('returns false for unknown phone', () => {
    expect(verifyCode('19999999999', '123456')).toBe(false)
  })

  it('deletes code after successful verification', () => {
    const { code } = generateCode('15551234567')
    verifyCode('15551234567', code!)
    // Second attempt should fail - code already consumed
    expect(verifyCode('15551234567', code!)).toBe(false)
  })
})
