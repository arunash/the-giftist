export type ChatSegment =
  | { type: 'text'; content: string }
  | { type: 'product'; data: ProductData }
  | { type: 'preferences'; data: Record<string, any> }

export interface ProductData {
  name: string
  price?: string
  image?: string
  id?: string
  url?: string
}

const PRODUCT_REGEX = /\[PRODUCT\]([\s\S]*?)\[\/PRODUCT\]/g
const PREFERENCES_REGEX = /\[PREFERENCES\]([\s\S]*?)\[\/PREFERENCES\]/g

export function parseChatContent(content: string): ChatSegment[] {
  const segments: ChatSegment[] = []
  let lastIndex = 0

  // Combine all special blocks with their positions
  const blocks: { start: number; end: number; type: 'product' | 'preferences'; raw: string }[] = []

  let match: RegExpExecArray | null

  const productRegex = new RegExp(PRODUCT_REGEX.source, 'g')
  while ((match = productRegex.exec(content)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'product',
      raw: match[1],
    })
  }

  const prefsRegex = new RegExp(PREFERENCES_REGEX.source, 'g')
  while ((match = prefsRegex.exec(content)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'preferences',
      raw: match[1],
    })
  }

  // Sort by position
  blocks.sort((a, b) => a.start - b.start)

  for (const block of blocks) {
    // Add text before this block
    if (block.start > lastIndex) {
      const text = content.slice(lastIndex, block.start).trim()
      if (text) {
        segments.push({ type: 'text', content: text })
      }
    }

    try {
      const parsed = JSON.parse(block.raw)
      if (block.type === 'product') {
        segments.push({ type: 'product', data: parsed as ProductData })
      } else {
        segments.push({ type: 'preferences', data: parsed })
      }
    } catch {
      // If JSON is malformed, treat as text
      segments.push({ type: 'text', content: block.raw })
    }

    lastIndex = block.end
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      segments.push({ type: 'text', content: text })
    }
  }

  return segments
}

export function stripSpecialBlocks(content: string): string {
  return content
    .replace(PRODUCT_REGEX, '')
    .replace(PREFERENCES_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
