/**
 * Tastemaker query — fetches scored gift recommendations from the
 * TastemakerGift table based on the user's message.
 *
 * This replaces Claude hallucinating products. Claude receives a
 * curated product list and picks from it.
 */

import { prisma } from './db'

interface TastemakerProduct {
  name: string
  price: string | null
  priceValue: number | null
  why: string | null
  totalScore: number
  signalCount: number
  domain: string | null
}

/**
 * Extract tags from a user message for querying the gift DB.
 */
function extractTags(message: string): {
  recipients: string[]
  occasions: string[]
  interests: string[]
  priceRange: string | null
} {
  const m = message.toLowerCase()

  const recipients: string[] = []
  const occasions: string[] = []
  const interests: string[] = []
  let priceRange: string | null = null

  // Recipients
  if (/\bmom|mother|mama|mum\b/.test(m)) recipients.push('mom')
  if (/\bdad|father|papa\b/.test(m)) recipients.push('dad')
  if (/\bpartner|wife|husband|boyfriend|girlfriend|fiancé|fiancee|spouse|bf|gf\b/.test(m)) recipients.push('partner')
  if (/\bfriend|bestie|bff|buddy\b/.test(m)) recipients.push('friend')
  if (/\bteacher|professor|mentor|coach\b/.test(m)) recipients.push('teacher')
  if (/\bcoworker|colleague|boss|manager\b/.test(m)) recipients.push('coworker')
  if (/\bsister|brother|sibling\b/.test(m)) recipients.push('sibling')
  if (/\bgrandma|grandmother|grandpa|grandfather|nana\b/.test(m)) recipients.push('grandparent')
  if (/\bson|daughter|kid|child|teen|baby|toddler\b/.test(m)) recipients.push('child')
  if (/\bmyself|self|treat me\b/.test(m)) recipients.push('self')
  if (/\bhim\b|male|man\b|guy\b/.test(m)) recipients.push('him')
  if (/\bher\b|female|woman\b|girl\b/.test(m)) recipients.push('her')

  // Occasions
  if (/mother'?s?\s*day/.test(m)) occasions.push('mothers-day')
  if (/father'?s?\s*day/.test(m)) occasions.push('fathers-day')
  if (/birthday|bday/.test(m)) occasions.push('birthday')
  if (/christmas|xmas|holiday/.test(m)) occasions.push('christmas')
  if (/anniversary/.test(m)) occasions.push('anniversary')
  if (/wedding|bridal/.test(m)) occasions.push('wedding')
  if (/baby\s*shower|new\s*baby/.test(m)) occasions.push('baby-shower')
  if (/graduat/.test(m)) occasions.push('graduation')
  if (/valentine/.test(m)) occasions.push('valentines')
  if (/thank|appreciat|host/.test(m)) occasions.push('thank-you')

  // Interests
  if (/cook|kitchen|chef|bak|foodie/.test(m)) interests.push('cooking')
  if (/outdoor|hik|camp|fish|garden|nature/.test(m)) interests.push('outdoor')
  if (/tech|gadget|electronic|gamer|gaming/.test(m)) interests.push('tech')
  if (/fitness|gym|workout|yoga|running|sport/.test(m)) interests.push('fitness')
  if (/beauty|skincare|makeup|spa|wellness/.test(m)) interests.push('beauty')
  if (/fashion|style|cloth|shoes|jewelry/.test(m)) interests.push('fashion')
  if (/read|book|literary/.test(m)) interests.push('reading')
  if (/music|musician|guitar|vinyl|concert/.test(m)) interests.push('music')
  if (/art|artist|creative|paint|craft/.test(m)) interests.push('art')
  if (/travel|adventure|exploring/.test(m)) interests.push('travel')
  if (/home|decor|interior|cozy|candle/.test(m)) interests.push('home')
  if (/wine|whiskey|bourbon|cocktail|beer/.test(m)) interests.push('wine')
  if (/dog|cat|pet|animal/.test(m)) interests.push('pets')
  if (/eco|sustainable|green|ethical/.test(m)) interests.push('sustainability')

  // Price range
  if (/budget|cheap|affordable|under \$[23]\d/.test(m)) priceRange = 'budget'
  else if (/under \$[5-7]\d|around \$50/.test(m)) priceRange = 'mid'
  else if (/under \$[12]\d\d|around \$100/.test(m)) priceRange = 'premium'
  else if (/luxur|splurge|expensive|fancy/.test(m)) priceRange = 'luxury'

  return { recipients, occasions, interests, priceRange }
}

/**
 * Query the TastemakerGift table for products matching the user's request.
 * Returns a formatted string to inject into Claude's system prompt.
 */
export async function getTastemakerProducts(userMessage: string): Promise<string> {
  const tags = extractTags(userMessage)

  // Build Prisma query — match ANY of the extracted tags
  const orConditions: any[] = []

  if (tags.recipients.length > 0) {
    orConditions.push({ recipientTypes: { hasSome: tags.recipients } })
  }
  if (tags.occasions.length > 0) {
    orConditions.push({ occasions: { hasSome: tags.occasions } })
  }
  if (tags.interests.length > 0) {
    orConditions.push({ interests: { hasSome: tags.interests } })
  }

  // If no tags extracted, get universal/top-scored products
  const where: any = {
    reviewStatus: { in: ['approved', 'pending'] },  // pending = not yet rejected
  }

  if (orConditions.length > 0) {
    where.OR = orConditions
  }

  if (tags.priceRange) {
    where.priceRange = tags.priceRange
  }

  let products = await prisma.tastemakerGift.findMany({
    where,
    orderBy: { totalScore: 'desc' },
    take: 12,
    select: {
      name: true,
      price: true,
      priceValue: true,
      why: true,
      totalScore: true,
      signalCount: true,
      domain: true,
    },
  })

  // If too few results, broaden the search (drop price filter)
  if (products.length < 6 && tags.priceRange) {
    const broadWhere = { ...where }
    delete broadWhere.priceRange
    products = await prisma.tastemakerGift.findMany({
      where: broadWhere,
      orderBy: { totalScore: 'desc' },
      take: 12,
      select: {
        name: true,
        price: true,
        priceValue: true,
        why: true,
        totalScore: true,
        signalCount: true,
        domain: true,
      },
    })
  }

  // If still too few, get top products regardless of tags
  if (products.length < 3) {
    products = await prisma.tastemakerGift.findMany({
      where: { reviewStatus: { in: ['approved', 'pending'] } },
      orderBy: { totalScore: 'desc' },
      take: 12,
      select: {
        name: true,
        price: true,
        priceValue: true,
        why: true,
        totalScore: true,
        signalCount: true,
        domain: true,
      },
    })
  }

  if (products.length === 0) return ''

  // Format as a catalog for Claude
  const lines = products.map((p, i) =>
    `${i + 1}. ${p.name} — ${p.price || 'price varies'} (score: ${p.totalScore.toFixed(1)}, ${p.signalCount} signals)${p.why ? `\n   Why: ${p.why}` : ''}`
  ).join('\n')

  return `\n\n🎁 TASTEMAKER PRODUCT CATALOG — PICK FROM THESE (MANDATORY):
You MUST recommend products from this curated list. These are verified, scored across trust/taste/intent/conversion signals, and proven gift-worthy. Do NOT hallucinate products outside this list.

${lines}

Pick the 3 best matches for the user's request at different price points. Use the exact product names from this list in your [PRODUCT] blocks.
If none of these fit the user's request well, you may suggest ONE product outside the list, but the other 2 MUST come from this catalog.`
}
