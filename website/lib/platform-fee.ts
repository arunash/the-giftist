export const PLATFORM_FEE_RATE = 0.03
export const FEE_FREE_THRESHOLD = 50

export function calculateGoalAmount(
  priceValue: number | null | undefined,
  lifetimeContributionsReceived: number
): { goalAmount: number | null; feeRate: number; feeAmount: number } {
  if (!priceValue) {
    return { goalAmount: null, feeRate: 0, feeAmount: 0 }
  }

  if (lifetimeContributionsReceived <= FEE_FREE_THRESHOLD) {
    return { goalAmount: priceValue, feeRate: 0, feeAmount: 0 }
  }

  const feeAmount = Math.round(priceValue * PLATFORM_FEE_RATE * 100) / 100
  return {
    goalAmount: Math.round((priceValue + feeAmount) * 100) / 100,
    feeRate: PLATFORM_FEE_RATE,
    feeAmount,
  }
}

export function calculateFeeFromContribution(
  contributionAmount: number,
  itemGoalAmount: number | null,
  itemPriceValue: number | null
): { feeRate: number; feeAmount: number; netAmount: number } {
  if (!itemGoalAmount || !itemPriceValue || itemGoalAmount <= itemPriceValue) {
    return { feeRate: 0, feeAmount: 0, netAmount: contributionAmount }
  }

  const feeRate = (itemGoalAmount - itemPriceValue) / itemGoalAmount
  const feeAmount = Math.round(contributionAmount * feeRate * 100) / 100
  return {
    feeRate: Math.round(feeRate * 10000) / 10000,
    feeAmount,
    netAmount: contributionAmount - feeAmount,
  }
}
