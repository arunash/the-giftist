// Existing affiliates (trim to strip trailing newlines from env vars)
const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG?.trim()
const WALMART_ID = process.env.NEXT_PUBLIC_WALMART_AFFILIATE_ID?.trim()
const TARGET_ID = process.env.NEXT_PUBLIC_TARGET_AFFILIATE_ID?.trim()

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

    // Amazon US — exact match so amazon.com.au / amazon.com.mx / etc. don't
    // get the US tag (they need their own country's Associates program).
    if (hostname === 'www.amazon.com' || hostname === 'amazon.com' || hostname === 'amzn.to') {
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

// Country (ISO-2) → Amazon storefront. US is the default; everything else
// gets rewritten so non-US users land on their local Amazon with the same
// search/product path. Tag is only applied for amazon.com (we only have a
// US Associates account); foreign Amazon clicks pass through untagged
// until those programs are registered.
const AMAZON_STOREFRONTS: Record<string, string> = {
  US: 'www.amazon.com',
  GB: 'www.amazon.co.uk',
  UK: 'www.amazon.co.uk',
  CA: 'www.amazon.ca',
  IN: 'www.amazon.in',
  JP: 'www.amazon.co.jp',
  DE: 'www.amazon.de',
  FR: 'www.amazon.fr',
  IT: 'www.amazon.it',
  ES: 'www.amazon.es',
  AU: 'www.amazon.com.au',
  MX: 'www.amazon.com.mx',
  BR: 'www.amazon.com.br',
  NL: 'www.amazon.nl',
  SE: 'www.amazon.se',
  AE: 'www.amazon.ae',
  SG: 'www.amazon.sg',
  PL: 'www.amazon.pl',
  TR: 'www.amazon.com.tr',
}

const AMAZON_HOSTS = new Set(Object.values(AMAZON_STOREFRONTS))

/**
 * If the URL is an Amazon storefront and the user is in a different country,
 * rewrite the host to that country's Amazon storefront. Path + query are
 * preserved (works for both /s?k=... search URLs and /dp/ASIN product URLs).
 *
 * country = 2-letter ISO from Vercel's x-vercel-ip-country header. Falls
 * back to no-rewrite for unknown countries (so they keep their existing host).
 */
export function rewriteAmazonForCountry(url: string, country: string | null | undefined): string {
  if (!country) return url
  const target = AMAZON_STOREFRONTS[country.toUpperCase()]
  if (!target) return url  // unknown country → leave alone
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (!AMAZON_HOSTS.has(host) && !host.includes('amzn.to')) return url
    if (host === target) return url
    parsed.hostname = target
    return parsed.toString()
  } catch {
    return url
  }
}
