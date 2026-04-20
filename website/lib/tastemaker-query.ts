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

STEP 1 — BEFORE selecting products, INFER from the user's message:
- WHO is the recipient? (personality, lifestyle, age, preferences — read between the lines)
- WHAT emotional reaction should the gift create? Choose the dominant emotion:
  • SURPRISE — "I can't believe you found this!" (unique, unexpected, personalized)
  • COMFORT — "This makes me feel so cared for" (cozy, practical luxury, self-care)
  • LUXURY — "I'd never buy this for myself" (premium, indulgent, aspirational)
  • FUN — "This is so cool!" (playful, creative, experience-driven)
  • SENTIMENTAL — "This means so much" (personalized, meaningful, memory-tied)

STEP 2 — Select 3 products using this PRIORITY ORDER:
1. GIFTABILITY — must feel like a great gift to receive (not something you'd buy yourself)
2. RELEVANCE — matches the recipient's personality, lifestyle, situation
3. SIGNAL STRENGTH — higher score = more expert/community endorsement
4. UNIQUENESS — avoid generic picks. Prefer "I'd never think of that!" over "obvious choice"

Do NOT blindly pick highest score if it's boring or mismatched. A score-2.0 product that perfectly matches the recipient beats a score-3.0 generic product.

Avoid overly generic gifts (candles, mugs, gift cards) UNLESS they are clearly premium or elevated in a meaningful way (e.g., Diptyque candle = premium, generic Target candle = NO).

At least ONE of your 3 picks should be a "surprise" — unexpected but perfect. Something that makes the recipient say "How did you know?!"

PRODUCT CATALOG (verified, multi-signal scored):

${lines}

PATTERN MATCHING:
- If you've seen similar requests before (e.g., "gift for mom who loves cooking"), favor products that worked well in those conversations — products users clicked, asked about, or said "yes" to.
- Popular picks for similar recipients/occasions should be weighted higher than novel but untested options.

SCORING LEGEND:
- Score: composite across Trust (Wirecutter, Consumer Reports), Taste (Strategist, Oprah), Intent (Reddit, TikTok), Conversion (Amazon, Etsy)
- Higher score = more sources recommend it. But score alone doesn't make a gift great — FIT does.

STEP 3 — ORDER YOUR PICKS:
1. BEST OVERALL MATCH — the one you're most confident about (first)
2. MOST UNIQUE/SURPRISING — the "how did you know?!" pick (second)
3. SAFE FALLBACK — crowd-pleaser, universally loved, can't go wrong (third)

TIEBREAKER: If two products are similar in fit, choose the one with BROADER SIGNAL COVERAGE (more layers = more independent sources endorsing it). A T+A+I product beats a T-only product.

STEP 4 — DIVERSITY CHECK. The 3 selected products MUST differ across:
- CATEGORY: not all kitchen, not all beauty, not all tech — spread across different areas of life
- EMOTIONAL TYPE: one practical/useful, one indulgent/luxurious, one meaningful/personal
- GIFTING STYLE: one safe/crowd-pleaser, one unique/unexpected, one memorable/sentimental

If your 3 picks fail this check, swap one out.

STEP 4 — WRITE THE RESPONSE. For each product, your reason sentence MUST include:
- A RECIPIENT-SPECIFIC reason — tie it to their identity, personality, or situation. Not "great kitchen tool" but "perfect for your mom who's always experimenting with new recipes"
- A MOMENT-OF-USE visualization — paint when/how they'll use it. Not "high quality" but "imagine her Sunday mornings, coffee staying hot while she reads on the porch"

RULES:
- Pick 3 products at DIFFERENT PRICE POINTS from this catalog
- Use the EXACT product name in your [PRODUCT] blocks
- Use the price shown — do not guess or change prices
- If the catalog is WEAK for this request (few matches, low relevance):
  → Still pick the 2 BEST matches from the catalog
  → Add 1 EXTERNAL recommendation that is highly relevant and compelling
  → Make the external pick the STANDOUT option — it should be the one that makes the user say "yes!"
  → The external product must be real, verifiable, and currently available
- NEVER mention scores, signals, "Tastemaker", or "catalog" to the user
- Your reason sentence is the MOST IMPORTANT part — it sells the gift by connecting product → person → moment
- Write in a WARM, CONFIDENT, HUMAN tone. You are a friend with incredible taste, not a search engine.
- Each recommendation should feel like a thoughtful suggestion from someone who genuinely knows great gifts.
- NEVER sound like a catalog listing. "This is the one" energy, not "Product features include..." energy.`
}
