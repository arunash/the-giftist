const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG
const WALMART_ID = process.env.NEXT_PUBLIC_WALMART_AFFILIATE_ID
const TARGET_ID = process.env.NEXT_PUBLIC_TARGET_AFFILIATE_ID
const ETSY_AFFILIATE_ID = process.env.NEXT_PUBLIC_ETSY_AFFILIATE_ID || '2774156'

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

    // Etsy (Awin affiliate link)
    if (hostname.includes('etsy.com')) {
      if (ETSY_AFFILIATE_ID) {
        return `https://www.awin1.com/cread.php?awinmid=6220&awinaffid=${ETSY_AFFILIATE_ID}&ued=${encodeURIComponent(url)}`
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
