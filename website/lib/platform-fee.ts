export const PLATFORM_FEE_RATE = 0.02
export const FREE_CONTRIBUTIONS_LIMIT = 10

// Goal amount is always the item price — no fee baked in
export function calculateGoalAmount(priceValue: number | null | undefined): {
  goalAmount: number | null
  feeRate: number
  feeAmount: number
} {
  return { goalAmount: priceValue || null, feeRate: 0, feeAmount: 0 }
}

// Fee is calculated at contribution time based on owner's received count
export function calculateFeeFromContribution(
  contributionAmount: number,
  ownerContributionsReceivedCount: number
): {
  feeRate: number
  feeAmount: number
  netAmount: number
  isFreeContribution: boolean
  freeRemaining: number
} {
  if (ownerContributionsReceivedCount < FREE_CONTRIBUTIONS_LIMIT) {
    return {
      feeRate: 0,
      feeAmount: 0,
      netAmount: contributionAmount,
      isFreeContribution: true,
      freeRemaining: FREE_CONTRIBUTIONS_LIMIT - ownerContributionsReceivedCount - 1,
    }
  }
  const feeAmount = Math.round(contributionAmount * PLATFORM_FEE_RATE * 100) / 100
  return {
    feeRate: PLATFORM_FEE_RATE,
    feeAmount,
    netAmount: contributionAmount - feeAmount,
    isFreeContribution: false,
    freeRemaining: 0,
  }
}
