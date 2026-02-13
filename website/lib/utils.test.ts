import { describe, it, expect } from 'vitest'
import { formatPrice, formatDate, daysUntil, getProgressPercentage, generateShareId, cn } from './utils'

describe('formatPrice', () => {
  it('formats a whole number price', () => {
    expect(formatPrice(25)).toBe('$25.00')
  })

  it('formats a decimal price', () => {
    expect(formatPrice(9.99)).toBe('$9.99')
  })

  it('formats a large price with comma grouping', () => {
    expect(formatPrice(1250)).toBe('$1,250.00')
  })

  it('returns empty string for null', () => {
    expect(formatPrice(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatPrice(undefined)).toBe('')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })
})

describe('formatDate', () => {
  it('formats a Date object', () => {
    const date = new Date('2024-06-15T12:00:00Z')
    const result = formatDate(date)
    expect(result).toContain('Jun')
    expect(result).toContain('2024')
  })

  it('formats a date string', () => {
    const result = formatDate('2024-12-25T12:00:00Z')
    expect(result).toContain('Dec')
    expect(result).toContain('2024')
  })

  it('returns a non-empty string', () => {
    expect(formatDate(new Date())).toBeTruthy()
  })
})

describe('daysUntil', () => {
  it('returns positive days for future dates', () => {
    const future = new Date()
    future.setDate(future.getDate() + 10)
    expect(daysUntil(future)).toBe(10)
  })

  it('returns negative days for past dates', () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    expect(daysUntil(past)).toBeLessThan(0)
  })

  it('returns 0 or 1 for today', () => {
    const today = new Date()
    const result = daysUntil(today)
    expect(result).toBeLessThanOrEqual(1)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('accepts a date string', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    expect(daysUntil(future.toISOString())).toBeGreaterThan(28)
  })
})

describe('getProgressPercentage', () => {
  it('returns 0 when goal is 0', () => {
    expect(getProgressPercentage(50, 0)).toBe(0)
  })

  it('returns 50 for halfway funded', () => {
    expect(getProgressPercentage(50, 100)).toBe(50)
  })

  it('caps at 100', () => {
    expect(getProgressPercentage(150, 100)).toBe(100)
  })

  it('rounds to nearest integer', () => {
    expect(getProgressPercentage(1, 3)).toBe(33)
  })

  it('returns 0 when funded is 0', () => {
    expect(getProgressPercentage(0, 100)).toBe(0)
  })

  it('returns 100 for exact match', () => {
    expect(getProgressPercentage(100, 100)).toBe(100)
  })
})

describe('generateShareId', () => {
  it('returns a string', () => {
    expect(typeof generateShareId()).toBe('string')
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateShareId()))
    expect(ids.size).toBe(100)
  })

  it('returns an 8-character string', () => {
    expect(generateShareId()).toHaveLength(8)
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden')).toBe('base')
  })

  it('merges tailwind conflicts', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2')
  })
})
