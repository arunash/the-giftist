// Existing affiliates
const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG
const WALMART_ID = process.env.NEXT_PUBLIC_WALMART_AFFILIATE_ID
const TARGET_ID = process.env.NEXT_PUBLIC_TARGET_AFFILIATE_ID

// Awin publisher ID (shared across Etsy, Bookshop.org, and any future Awin merchants)
const AWIN_PUBLISHER_ID = process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID || '2774156'

// New affiliates
const UNCOMMON_GOODS_IMPACT_ID = process.env.NEXT_PUBLIC_UNCOMMON_GOODS_IMPACT_ID
const MASTERCLASS_SHAREASALE_ID = process.env.NEXT_PUBLIC_MASTERCLASS_SHAREASALE_ID
const CRATEJOY_IMPACT_ID = process.env.NEXT_PUBLIC_CRATEJOY_IMPACT_ID
const FOOD52_PARTNERIZE_ID = process.env.NEXT_PUBLIC_FOOD52_PARTNERIZE_ID
const NORDSTROM_RAKUTEN_ID = process.env.NEXT_PUBLIC_NORDSTROM_RAKUTEN_ID

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

    // Etsy (Awin — merchant 6220)
    if (hostname.includes('etsy.com')) {
      if (AWIN_PUBLISHER_ID) {
        return `https://www.awin1.com/cread.php?awinmid=6220&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(url)}`
      }
    }

    // Walmart
    if (hostname.includes('walmart.com')) {
      if (WALMART_ID) {
        parsed.searchParams.set('affiliateCampaignId', WALMART_ID)
        return parsed.toString()
      }
    }

    // Target (Impact)
    if (hostname.includes('target.com')) {
      if (TARGET_ID) {
        return `https://goto.target.com/c/${TARGET_ID}/2?u=${encodeURIComponent(url)}`
      }
    }

    // Uncommon Goods (Impact)
    if (hostname.includes('uncommongoods.com')) {
      if (UNCOMMON_GOODS_IMPACT_ID) {
        return `https://uncommongoods.sjv.io/c/${UNCOMMON_GOODS_IMPACT_ID}/2?u=${encodeURIComponent(url)}`
      }
    }

    // Bookshop.org (Awin — merchant 92005)
    if (hostname.includes('bookshop.org')) {
      if (AWIN_PUBLISHER_ID) {
        return `https://www.awin1.com/cread.php?awinmid=92005&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(url)}`
      }
    }

    // MasterClass (ShareASale / Awin)
    if (hostname.includes('masterclass.com')) {
      if (MASTERCLASS_SHAREASALE_ID) {
        return `https://shareasale.com/r.cfm?b=999&u=${MASTERCLASS_SHAREASALE_ID}&m=62509&urllink=${encodeURIComponent(url)}`
      }
    }

    // Cratejoy (Impact)
    if (hostname.includes('cratejoy.com')) {
      if (CRATEJOY_IMPACT_ID) {
        return `https://cratejoy.sjv.io/c/${CRATEJOY_IMPACT_ID}/2?u=${encodeURIComponent(url)}`
      }
    }

    // Food52 (Partnerize)
    if (hostname.includes('food52.com')) {
      if (FOOD52_PARTNERIZE_ID) {
        return `https://food52.prf.hn/click/camref:${FOOD52_PARTNERIZE_ID}/destination:${encodeURIComponent(url)}`
      }
    }

    // Nordstrom (Rakuten)
    if (hostname.includes('nordstrom.com')) {
      if (NORDSTROM_RAKUTEN_ID) {
        return `https://click.linksynergy.com/deeplink?id=${NORDSTROM_RAKUTEN_ID}&mid=1237&murl=${encodeURIComponent(url)}`
      }
    }
  } catch {
    // Invalid URL — return as-is
  }

  return url
}
