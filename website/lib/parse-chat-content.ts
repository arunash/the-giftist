export interface EventData {
  name: string
  type: string
  date: string
  description?: string
}

export interface AddToEventData {
  itemId?: string
  itemRef?: string
  eventId?: string
  eventRef?: string
  itemName: string
  eventName: string
  price?: string
  url?: string
}

export interface AddCircleData {
  phone: string
  name?: string
  relationship?: string
}

export interface RemoveCircleData {
  name: string
}

export interface SendRemindersData {
  eventRef?: string
  eventName: string
}

export type ChatSegment =
  | { type: 'text'; content: string }
  | { type: 'product'; data: ProductData }
  | { type: 'preferences'; data: Record<string, any> }
  | { type: 'event'; data: EventData }
  | { type: 'add_to_event'; data: AddToEventData }
  | { type: 'add_circle'; data: AddCircleData }
  | { type: 'remove_circle'; data: RemoveCircleData }
  | { type: 'send_reminders'; data: SendRemindersData }

export interface ProductData {
  name: string
  price?: string
  image?: string
  id?: string
  url?: string
}

const PRODUCT_REGEX = /\[PRODUCT\]([\s\S]*?)\[\/PRODUCT\]/g
const PREFERENCES_REGEX = /\[PREFERENCES\]([\s\S]*?)\[\/PREFERENCES\]/g
const EVENT_REGEX = /\[EVENT\]([\s\S]*?)\[\/EVENT\]/g
const ADD_TO_EVENT_REGEX = /\[ADD_TO_EVENT\]([\s\S]*?)\[\/ADD_TO_EVENT\]/g
const ADD_CIRCLE_REGEX = /\[ADD_CIRCLE\]([\s\S]*?)\[\/ADD_CIRCLE\]/g
const REMOVE_CIRCLE_REGEX = /\[REMOVE_CIRCLE\]([\s\S]*?)\[\/REMOVE_CIRCLE\]/g
const SEND_REMINDERS_REGEX = /\[SEND_REMINDERS\]([\s\S]*?)\[\/SEND_REMINDERS\]/g

export function parseChatContent(content: string): ChatSegment[] {
  const segments: ChatSegment[] = []
  let lastIndex = 0

  // Combine all special blocks with their positions
  const blocks: { start: number; end: number; type: ChatSegment['type']; raw: string }[] = []

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

  const eventRegex = new RegExp(EVENT_REGEX.source, 'g')
  while ((match = eventRegex.exec(content)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'event',
      raw: match[1],
    })
  }

  const addToEventRegex = new RegExp(ADD_TO_EVENT_REGEX.source, 'g')
  while ((match = addToEventRegex.exec(content)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'add_to_event',
      raw: match[1],
    })
  }

  const addCircleRegex = new RegExp(ADD_CIRCLE_REGEX.source, 'g')
  while ((match = addCircleRegex.exec(content)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'add_circle',
      raw: match[1],
    })
  }

  const removeCircleRegex = new RegExp(REMOVE_CIRCLE_REGEX.source, 'g')
  while ((match = removeCircleRegex.exec(content)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'remove_circle',
      raw: match[1],
    })
  }

  const sendRemindersRegex = new RegExp(SEND_REMINDERS_REGEX.source, 'g')
  while ((match = sendRemindersRegex.exec(content)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'send_reminders',
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
      } else if (block.type === 'event') {
        segments.push({ type: 'event', data: parsed as EventData })
      } else if (block.type === 'add_to_event') {
        segments.push({ type: 'add_to_event', data: parsed as AddToEventData })
      } else if (block.type === 'add_circle') {
        segments.push({ type: 'add_circle', data: parsed as AddCircleData })
      } else if (block.type === 'remove_circle') {
        segments.push({ type: 'remove_circle', data: parsed as RemoveCircleData })
      } else if (block.type === 'send_reminders') {
        segments.push({ type: 'send_reminders', data: parsed as SendRemindersData })
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
    .replace(EVENT_REGEX, '')
    .replace(ADD_TO_EVENT_REGEX, '')
    .replace(ADD_CIRCLE_REGEX, '')
    .replace(REMOVE_CIRCLE_REGEX, '')
    .replace(SEND_REMINDERS_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
