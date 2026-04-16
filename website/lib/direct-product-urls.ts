/**
 * Direct product URL lookup — maps well-known products to their actual URLs.
 *
 * This bypasses the LLM search entirely for products we know about.
 * Much faster (no API calls) and 100% reliable (no hallucinated URLs).
 *
 * The cache in ProductUrlCache handles previously-seen products.
 * This file handles products Claude recommends frequently that we can
 * map directly to retailer URLs without any search.
 */

interface DirectProduct {
  url: string
  domain: string
  price: string
  priceValue: number
  image?: string
}

// Brand → product name patterns → direct URLs
// These are products Claude recommends most often.
const DIRECT_PRODUCTS: Record<string, DirectProduct> = {
  // ── Skincare & Beauty ──
  'the ordinary niacinamide 10% + zinc 1% serum': {
    url: 'https://www.amazon.com/dp/B08GSY67QN',
    domain: 'www.amazon.com', price: '$6.50', priceValue: 6.50,
  },
  'tatcha dewy skin set': {
    url: 'https://www.tatcha.com/product/dewy-skin-set/CC08010T.html',
    domain: 'www.tatcha.com', price: '$68', priceValue: 68,
  },
  'herbivore botanicals prism aha + bha exfoliating glow facial': {
    url: 'https://www.amazon.com/dp/B08GYBM2PN',
    domain: 'www.amazon.com', price: '$48', priceValue: 48,
  },
  'augustinus bader the rich cream': {
    url: 'https://www.amazon.com/dp/B07GZ7J5YZ',
    domain: 'www.amazon.com', price: '$170', priceValue: 170,
  },
  'e.l.f. cosmetics putty primer': {
    url: 'https://www.amazon.com/dp/B07Q74SRTW',
    domain: 'www.amazon.com', price: '$10', priceValue: 10,
  },
  'revlon one-step volumizer hair dryer brush': {
    url: 'https://www.amazon.com/dp/B01LSUQSB0',
    domain: 'www.amazon.com', price: '$35', priceValue: 35,
  },

  // ── Fragrance ──
  'le labo santal 33': {
    url: 'https://www.lelabofragrances.com/santal-33-702.html',
    domain: 'www.lelabofragrances.com', price: '$220', priceValue: 220,
  },

  // ── Jewelry ──
  'mejuri bold hoops': {
    url: 'https://www.mejuri.com/products/bold-hoops',
    domain: 'www.mejuri.com', price: '$65', priceValue: 65,
  },

  // ── Kitchen & Home ──
  'le creuset mini cocotte set': {
    url: 'https://www.amazon.com/dp/B009JDLWH0',
    domain: 'www.amazon.com', price: '$60', priceValue: 60,
  },
  'bee\'s wrap assorted 3 pack reusable food storage': {
    url: 'https://www.amazon.com/dp/B01N0MSCF6',
    domain: 'www.amazon.com', price: '$18', priceValue: 18,
  },
  'fellow opus conical burr grinder': {
    url: 'https://www.amazon.com/dp/B0BR7QDXPG',
    domain: 'www.amazon.com', price: '$80', priceValue: 80,
  },
  'fellow atmos vacuum canister': {
    url: 'https://www.amazon.com/dp/B098R62VBV',
    domain: 'www.amazon.com', price: '$35', priceValue: 35,
  },

  // ── Tech ──
  'kindle paperwhite': {
    url: 'https://www.amazon.com/dp/B09TMN58KL',
    domain: 'www.amazon.com', price: '$150', priceValue: 150,
  },
  'theragun mini portable massage gun': {
    url: 'https://www.amazon.com/dp/B0BZK2YM4C',
    domain: 'www.amazon.com', price: '$179', priceValue: 179,
  },

  // ── Drinkware ──
  'hydro flask 32oz wide mouth with straw lid': {
    url: 'https://www.amazon.com/dp/B09GDWPQN8',
    domain: 'www.amazon.com', price: '$45', priceValue: 45,
  },
  'yeti rambler 26oz': {
    url: 'https://www.amazon.com/dp/B0BXDTNPDB',
    domain: 'www.amazon.com', price: '$40', priceValue: 40,
  },
  'klean kanteen classic insulated 20oz bottle': {
    url: 'https://www.amazon.com/dp/B005EPYRNK',
    domain: 'www.amazon.com', price: '$32', priceValue: 32,
  },

  // ── Experiences ──
  'masterclass annual membership': {
    url: 'https://www.masterclass.com/gift',
    domain: 'www.masterclass.com', price: '$120', priceValue: 120,
  },

  // ── Books ──
  'the hidden life of trees by peter wohlleben': {
    url: 'https://www.amazon.com/dp/1771642483',
    domain: 'www.amazon.com', price: '$13', priceValue: 13,
  },

  // ── Fashion ──
  'blundstone original 500 series chelsea boots': {
    url: 'https://www.amazon.com/dp/B00BFXIM2Y',
    domain: 'www.amazon.com', price: '$210', priceValue: 210,
  },
  'veja v-10 leather sneakers': {
    url: 'https://www.nordstrom.com/s/veja-v-10-sneaker/5070188',
    domain: 'www.nordstrom.com', price: '$160', priceValue: 160,
  },

  // ── Outdoor ──
  'rei co-op recycled tote bag': {
    url: 'https://www.rei.com/product/171753/rei-co-op-recycled-tote-bag',
    domain: 'www.rei.com', price: '$10', priceValue: 10,
  },

  // ── Grilling ──
  'weber premium grilling set': {
    url: 'https://www.amazon.com/dp/B07V5JHVY3',
    domain: 'www.amazon.com', price: '$89', priceValue: 89,
  },

  // ── Food & Drink ──
  'blue bottle coffee subscription (3 months)': {
    url: 'https://www.amazon.com/dp/B07ZYBX6L7',
    domain: 'www.amazon.com', price: '$40', priceValue: 40,
  },
  'diaspora co. pragati turmeric': {
    url: 'https://www.diasporaco.com/products/pragati-turmeric',
    domain: 'www.diasporaco.com', price: '$12', priceValue: 12,
  },

  // ── Bedding ──
  'cozy earth bamboo sheet set queen': {
    url: 'https://www.amazon.com/dp/B0CX6LRWFC',
    domain: 'www.amazon.com', price: '$140', priceValue: 140,
  },
}

/**
 * Try to find a direct URL for a product without any API calls.
 * Uses fuzzy matching on the product name.
 */
export function findDirectProductUrl(productName: string): DirectProduct | null {
  const normalized = productName.toLowerCase().trim()

  // Exact match
  if (DIRECT_PRODUCTS[normalized]) {
    return DIRECT_PRODUCTS[normalized]
  }

  // Fuzzy match — check if any key is a substring or vice versa
  for (const [key, product] of Object.entries(DIRECT_PRODUCTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return product
    }
  }

  // Word-overlap match — at least 70% of key words match
  const inputWords = normalized.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
  for (const [key, product] of Object.entries(DIRECT_PRODUCTS)) {
    const keyWords = key.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
    const matches = keyWords.filter(w => inputWords.some(iw => iw.includes(w) || w.includes(iw)))
    if (keyWords.length >= 2 && matches.length / keyWords.length >= 0.7) {
      return product
    }
  }

  return null
}
