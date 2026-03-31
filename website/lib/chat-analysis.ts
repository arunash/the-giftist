import Anthropic from '@anthropic-ai/sdk'
import { logApiCall } from './api-logger'

const anthropic = new Anthropic()

// ── Types ──

export interface ParsedMessage {
  timestamp: string
  sender: string
  text: string
}

export interface FriendProfile {
  interests: string[]
  brands: string[]
  wishStatements: string[]
  style: string
  pricePreference: string
  dislikes: string[]
  categories: string[]
  personality: string
  favoriteStores: string[]
  sizes: Record<string, string>
}

// ── WhatsApp Export Parser ──

// Handles iOS and Android export formats, multiple date/locale styles
const MESSAGE_REGEX = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\]?\s*[-–—]?\s*([^:]+?):\s(.+)/

export function parseWhatsAppExport(text: string): ParsedMessage[] {
  const lines = text.split('\n')
  const messages: ParsedMessage[] = []
  let current: ParsedMessage | null = null

  for (const line of lines) {
    const match = line.match(MESSAGE_REGEX)
    if (match) {
      if (current) messages.push(current)
      current = {
        timestamp: match[1],
        sender: match[2].trim(),
        text: match[3].trim(),
      }
    } else if (current && line.trim()) {
      // Continuation of previous message
      current.text += '\n' + line.trim()
    }
  }
  if (current) messages.push(current)

  return messages
}

// ── Sender Identification ──

export function identifySenders(messages: ParsedMessage[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const m of messages) {
    counts.set(m.sender, (counts.get(m.sender) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

// ── Filter & Sample ──

const SKIP_PATTERNS = [
  /^<media omitted>$/i,
  /^<attached: /i,
  /^this message was deleted$/i,
  /^you deleted this message$/i,
  /^missed voice call$/i,
  /^missed video call$/i,
  /^\u200e/, // left-to-right mark (system messages)
  /^waiting for this message/i,
  /^messages and calls are end-to-end encrypted/i,
]

const TOO_SHORT_REGEX = /^(ok|okay|k|ya|yah|yeah|yes|no|lol|haha|hehe|omg|wow|nice|cool|sure|ty|thx|thanks|np|gn|gm|idk|hmm|brb|ttyl|❤️|👍|😂|😭|🙏|💀)$/i

export function filterAndSampleMessages(
  messages: ParsedMessage[],
  targetSender: string,
  maxMessages = 2000,
): ParsedMessage[] {
  // Filter to target sender's messages, skip noise
  const filtered = messages.filter(m => {
    if (m.sender !== targetSender) return false
    if (SKIP_PATTERNS.some(p => p.test(m.text))) return false
    if (TOO_SHORT_REGEX.test(m.text.trim())) return false
    if (m.text.length < 4) return false
    return true
  })

  if (filtered.length <= maxMessages) return filtered

  // Sample: take the most recent messages (most relevant for current preferences)
  // but sprinkle in older ones for broader coverage
  const recentCount = Math.floor(maxMessages * 0.7)
  const olderCount = maxMessages - recentCount

  const recent = filtered.slice(-recentCount)
  const older = filtered.slice(0, filtered.length - recentCount)

  // Evenly sample from older messages
  const step = Math.max(1, Math.floor(older.length / olderCount))
  const sampledOlder: ParsedMessage[] = []
  for (let i = 0; i < older.length && sampledOlder.length < olderCount; i += step) {
    sampledOlder.push(older[i])
  }

  return [...sampledOlder, ...recent]
}

// ── Claude Extraction ──

const EXTRACTION_PROMPT = `You are analyzing a WhatsApp chat export to build a gift preference profile for a person. The messages below are all from one sender.

Extract their preferences into this exact JSON structure:

{
  "interests": ["..."],        // hobbies, topics they talk about frequently
  "brands": ["..."],           // brands mentioned positively
  "wishStatements": ["..."],   // direct quotes where they say "I want...", "I need...", "I wish...", "I've been looking for..."
  "style": "...",              // aesthetic description relevant to gifting (e.g. minimalist, colorful, outdoorsy, techy)
  "pricePreference": "...",    // budget signals: luxury, mid-range, budget-conscious, or mixed
  "dislikes": ["..."],         // things they've expressed dislike for
  "categories": ["..."],       // product categories they'd appreciate (e.g. books, tech, fashion, home, cooking, fitness)
  "personality": "...",        // brief personality summary relevant to gifting (2-3 sentences max)
  "favoriteStores": ["..."],   // stores or retailers mentioned
  "sizes": {}                  // any clothing/shoe sizes mentioned, e.g. {"shirt": "M", "shoe": "10"}
}

RULES:
- Only include things clearly evidenced by the messages — do NOT guess or assume
- wishStatements should be EXACT quotes, not paraphrased
- Keep arrays to max 15 items each, prioritize most recent/frequent
- If you can't determine something, use an empty array or empty string
- Return ONLY valid JSON, no markdown or explanation`

export async function extractFriendProfile(
  messages: ParsedMessage[],
  friendName: string,
): Promise<FriendProfile> {
  // Chunk if very large (>2000 messages)
  const chunks: ParsedMessage[][] = []
  const CHUNK_SIZE = 2000
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + CHUNK_SIZE))
  }

  const profiles: FriendProfile[] = []

  for (const chunk of chunks) {
    const messageText = chunk
      .map(m => m.text)
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: EXTRACTION_PROMPT,
      messages: [{
        role: 'user',
        content: `Here are ${chunk.length} messages from ${friendName}:\n\n${messageText}`,
      }],
    })

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      source: 'CHAT_ANALYSIS',
    }).catch(() => {})

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        profiles.push(parsed)
      }
    } catch {
      // If one chunk fails to parse, continue with others
      console.error('[ChatAnalysis] Failed to parse chunk response')
    }
  }

  if (profiles.length === 0) {
    return emptyProfile()
  }

  if (profiles.length === 1) {
    return profiles[0]
  }

  return mergeProfiles(profiles)
}

// ── Merge multiple chunk results ──

function mergeProfiles(profiles: FriendProfile[]): FriendProfile {
  const merged: FriendProfile = emptyProfile()

  for (const p of profiles) {
    merged.interests.push(...(p.interests || []))
    merged.brands.push(...(p.brands || []))
    merged.wishStatements.push(...(p.wishStatements || []))
    merged.dislikes.push(...(p.dislikes || []))
    merged.categories.push(...(p.categories || []))
    merged.favoriteStores.push(...(p.favoriteStores || []))
    if (p.style && !merged.style) merged.style = p.style
    if (p.pricePreference && !merged.pricePreference) merged.pricePreference = p.pricePreference
    if (p.personality && !merged.personality) merged.personality = p.personality
    if (p.sizes) Object.assign(merged.sizes, p.sizes)
  }

  // Deduplicate arrays (case-insensitive)
  const dedup = (arr: string[]) => {
    const seen = new Set<string>()
    return arr.filter(item => {
      const key = item.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 15)
  }

  merged.interests = dedup(merged.interests)
  merged.brands = dedup(merged.brands)
  merged.wishStatements = dedup(merged.wishStatements)
  merged.dislikes = dedup(merged.dislikes)
  merged.categories = dedup(merged.categories)
  merged.favoriteStores = dedup(merged.favoriteStores)

  return merged
}

function emptyProfile(): FriendProfile {
  return {
    interests: [],
    brands: [],
    wishStatements: [],
    style: '',
    pricePreference: '',
    dislikes: [],
    categories: [],
    personality: '',
    favoriteStores: [],
    sizes: {},
  }
}

// ── Profile Summary (for WhatsApp/display) ──

export function profileSummary(profile: FriendProfile, friendName: string): string {
  const parts: string[] = []
  parts.push(`Here's what I learned about ${friendName}:`)

  if (profile.personality) parts.push(`\n*Personality:* ${profile.personality}`)
  if (profile.interests.length) parts.push(`\n*Interests:* ${profile.interests.join(', ')}`)
  if (profile.brands.length) parts.push(`*Brands they love:* ${profile.brands.join(', ')}`)
  if (profile.categories.length) parts.push(`*Gift categories:* ${profile.categories.join(', ')}`)
  if (profile.style) parts.push(`*Style:* ${profile.style}`)
  if (profile.pricePreference) parts.push(`*Budget vibe:* ${profile.pricePreference}`)
  if (profile.dislikes.length) parts.push(`*Dislikes:* ${profile.dislikes.join(', ')}`)
  if (profile.wishStatements.length) {
    const top = profile.wishStatements.slice(0, 5)
    parts.push(`\n*Things they've said they want:*`)
    for (const w of top) parts.push(`  → "${w}"`)
  }
  if (profile.favoriteStores.length) parts.push(`\n*Favorite stores:* ${profile.favoriteStores.join(', ')}`)
  if (Object.keys(profile.sizes).length) {
    const sizeStr = Object.entries(profile.sizes).map(([k, v]) => `${k}: ${v}`).join(', ')
    parts.push(`*Sizes:* ${sizeStr}`)
  }

  return parts.join('\n')
}

// ── Gift Suggestions from Profile ──

export interface GiftSuggestion {
  name: string
  price: string
  reason: string
  url?: string
}

export async function suggestGiftsFromProfile(
  profile: FriendProfile,
  friendName: string,
  opts?: { userId?: string; source?: string },
): Promise<GiftSuggestion[]> {
  const profileStr = [
    profile.interests.length ? `Interests: ${profile.interests.join(', ')}` : '',
    profile.brands.length ? `Brands: ${profile.brands.join(', ')}` : '',
    profile.categories.length ? `Categories: ${profile.categories.join(', ')}` : '',
    profile.style ? `Style: ${profile.style}` : '',
    profile.pricePreference ? `Budget: ${profile.pricePreference}` : '',
    profile.dislikes.length ? `Dislikes: ${profile.dislikes.join(', ')}` : '',
    profile.wishStatements.length ? `They said they want: ${profile.wishStatements.slice(0, 5).join('; ')}` : '',
  ].filter(Boolean).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `You suggest gifts based on someone's Gift DNA. Return exactly 3 suggestions as a JSON array. Each item: {"name":"specific real product name with brand","price":"$XX","reason":"one sentence why this fits"}. Use real, specific product names (e.g. "Yeti Rambler 26oz Bottle" not "insulated water bottle"). Return ONLY the JSON array, no markdown.`,
    messages: [{
      role: 'user',
      content: `Suggest 3 gift ideas for ${friendName} based on this profile:\n\n${profileStr}`,
    }],
  })

  logApiCall({
    provider: 'ANTHROPIC',
    endpoint: '/messages',
    model: 'claude-haiku-4-5-20251001',
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    source: 'GIFT_SUGGESTIONS',
  }).catch(() => {})

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let suggestions: GiftSuggestion[] = []
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      suggestions = JSON.parse(jsonMatch[0])
    }
  } catch {}

  // Create tracked Giftist links for each suggestion, resolving images
  if (suggestions.length > 0) {
    const { createTrackedLink } = await import('@/lib/product-link')
    const { findProductUrl } = await import('@/lib/enrich-item')
    const { findProductImage } = await import('@/lib/product-image')
    const { extractProductFromUrl } = await import('@/lib/extract')
    const { aiImageFallback } = await import('@/lib/ai-image-fallback')

    const baseUrl = process.env.NEXTAUTH_URL || 'https://giftist.ai'

    await Promise.all(suggestions.map(async (s) => {
      try {
        // Try to find a real product URL
        const found = await findProductUrl(s.name).catch(() => null)
        const targetUrl = found?.url || null

        // Layer 1: Try scraping from retailer URL
        let image: string | null = null
        if (targetUrl) {
          try {
            const scraped = await extractProductFromUrl(targetUrl)
            if (scraped.image) image = scraped.image
          } catch {}
        }

        // Layer 2: Search engines (Bing, Google, DDG)
        if (!image) {
          try { image = await findProductImage(s.name) } catch {}
        }

        // Layer 3: AI-powered fallback (Claude generates search queries + branded card)
        if (!image) {
          try { image = await aiImageFallback(s.name, baseUrl) } catch {}
        }

        let priceValue: number | null = null
        if (s.price) {
          const m = s.price.replace(/,/g, '').match(/[\d.]+/)
          if (m) priceValue = parseFloat(m[0])
        }

        // Always create tracked link — AI fallback guarantees an image
        if (image && targetUrl) {
          s.url = await createTrackedLink({
            productName: s.name,
            targetUrl,
            price: s.price,
            priceValue,
            image: image.includes('/api/product-image') ? null : image,
            userId: opts?.userId,
            source: opts?.source || 'SUGGESTION',
          })
        }
      } catch {}
    }))
  }

  // Filter out suggestions without images/URLs — never show links without images
  return suggestions.filter(s => s.url)
}
