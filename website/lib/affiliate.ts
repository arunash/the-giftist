const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG
const WALMART_ID = process.env.NEXT_PUBLIC_WALMART_AFFILIATE_ID
const TARGET_ID = process.env.NEXT_PUBLIC_TARGET_AFFILIATE_ID

export function applyAffiliateTag(url: string): string {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Amazon
    if (hostname.includes('amazon.com') || hostname.includes('amzn.to')) {
      if (AMAZON_TAG) {
        parsed.searchParams.set('tag', AMAZON_TAG)
        return parsed.toString()
      }
    }

    // Walmart
    if (hostname.includes('walmart.com')) {
      if (WALMART_ID) {
        parsed.searchParams.set('affiliateCampaignId', WALMART_ID)
        return parsed.toString()
      }
    }

    // Target (Impact Radius)
    if (hostname.includes('target.com')) {
      if (TARGET_ID) {
        return `https://goto.target.com/c/${TARGET_ID}/2?u=${encodeURIComponent(url)}`
      }
    }
  } catch {
    // Invalid URL — return as-is
  }

  return url
}
