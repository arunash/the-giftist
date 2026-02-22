import { describe, it, expect } from 'vitest'
import {
  PLATFORM_FEE_RATE,
  FREE_CONTRIBUTIONS_LIMIT,
  calculateGoalAmount,
  calculateFeeFromContribution,
} from './platform-fee'

describe('platform-fee constants', () => {
  it('fee rate is 2%', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.02)
  })

  it('free contributions limit is 10', () => {
    expect(FREE_CONTRIBUTIONS_LIMIT).toBe(10)
  })
})

describe('calculateGoalAmount', () => {
  it('returns priceValue as goalAmount with no fee', () => {
    const result = calculateGoalAmount(49.99)
    expect(result).toEqual({ goalAmount: 49.99, feeRate: 0, feeAmount: 0 })
  })

  it('returns null goalAmount for null priceValue', () => {
    expect(calculateGoalAmount(null)).toEqual({ goalAmount: null, feeRate: 0, feeAmount: 0 })
  })

  it('returns null goalAmount for undefined priceValue', () => {
    expect(calculateGoalAmount(undefined)).toEqual({ goalAmount: null, feeRate: 0, feeAmount: 0 })
  })

  it('returns null goalAmount for zero priceValue', () => {
    expect(calculateGoalAmount(0)).toEqual({ goalAmount: null, feeRate: 0, feeAmount: 0 })
  })

  it('never inflates goal amount regardless of price', () => {
    const result = calculateGoalAmount(1000)
    expect(result.goalAmount).toBe(1000)
    expect(result.feeRate).toBe(0)
    expect(result.feeAmount).toBe(0)
  })
})

describe('calculateFeeFromContribution', () => {
  describe('free tier (< 10 contributions received)', () => {
    it('first contribution is free', () => {
      const result = calculateFeeFromContribution(100, 0)
      expect(result.feeRate).toBe(0)
      expect(result.feeAmount).toBe(0)
      expect(result.netAmount).toBe(100)
      expect(result.isFreeContribution).toBe(true)
      expect(result.freeRemaining).toBe(9)
    })

    it('5th contribution is free with 5 remaining', () => {
      const result = calculateFeeFromContribution(50, 4)
      expect(result.feeAmount).toBe(0)
      expect(result.netAmount).toBe(50)
      expect(result.isFreeContribution).toBe(true)
      expect(result.freeRemaining).toBe(5)
    })

    it('10th contribution (index 9) is free with 0 remaining', () => {
      const result = calculateFeeFromContribution(75, 9)
      expect(result.feeAmount).toBe(0)
      expect(result.netAmount).toBe(75)
      expect(result.isFreeContribution).toBe(true)
      expect(result.freeRemaining).toBe(0)
    })
  })

  describe('paid tier (>= 10 contributions received)', () => {
    it('11th contribution (index 10) charges 2%', () => {
      const result = calculateFeeFromContribution(100, 10)
      expect(result.feeRate).toBe(0.02)
      expect(result.feeAmount).toBe(2)
      expect(result.netAmount).toBe(98)
      expect(result.isFreeContribution).toBe(false)
      expect(result.freeRemaining).toBe(0)
    })

    it('charges 2% on $50 contribution', () => {
      const result = calculateFeeFromContribution(50, 15)
      expect(result.feeAmount).toBe(1)
      expect(result.netAmount).toBe(49)
    })

    it('rounds fee to 2 decimal places', () => {
      const result = calculateFeeFromContribution(33.33, 20)
      expect(result.feeAmount).toBe(0.67) // 33.33 * 0.02 = 0.6666 → 0.67
      expect(result.netAmount).toBe(32.66)
    })

    it('handles large contributions', () => {
      const result = calculateFeeFromContribution(1000, 100)
      expect(result.feeAmount).toBe(20)
      expect(result.netAmount).toBe(980)
    })

    it('handles small contributions', () => {
      const result = calculateFeeFromContribution(1, 10)
      expect(result.feeAmount).toBe(0.02)
      expect(result.netAmount).toBe(0.98)
    })
  })
})
