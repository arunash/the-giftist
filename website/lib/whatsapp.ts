import { logApiCall } from '@/lib/api-logger'
import { prisma } from './db'
import { isPrivateUrl } from './url-safety'

const GRAPH_API = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`
const TOKEN = () => process.env.WHATSAPP_ACCESS_TOKEN!

// Blocked numbers — no outbound messages will be sent to these
const BLOCKED_NUMBERS = new Set([
  '15550000000',
])

function isBlocked(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return BLOCKED_NUMBERS.has(digits)
}

async function graphPost(endpoint: string, body: object) {
  const res = await fetch(`${GRAPH_API}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function sendTextMessage(to: string, body: string) {
  if (isBlocked(to)) return { messages: [] }
  const result = await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  })
  logApiCall({ provider: 'WHATSAPP', endpoint: '/messages', source: 'WHATSAPP' }).catch(() => {})
  const waMessageId = result?.messages?.[0]?.id
  if (waMessageId) {
    prisma.whatsAppMessage.create({
      data: { waMessageId, phone: to, type: 'OUTBOUND', content: body, status: 'SENT' },
    }).catch(() => {})
  }
  return result
}

/** Send an interactive message with quick-reply buttons (max 3 buttons) */
export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  header?: string,
  footer?: string,
) {
  if (isBlocked(to)) return { messages: [] }
  const interactive: any = {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.slice(0, 3).map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: b.title.slice(0, 20) },
      })),
    },
  }
  if (header) interactive.header = { type: 'text', text: header }
  if (footer) interactive.footer = { text: footer }

  const result = await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  })
  logApiCall({ provider: 'WHATSAPP', endpoint: '/messages', source: 'WHATSAPP' }).catch(() => {})
  const waMessageId = result?.messages?.[0]?.id
  if (waMessageId) {
    prisma.whatsAppMessage.create({
      data: { waMessageId, phone: to, type: 'OUTBOUND', content: body, status: 'SENT' },
    }).catch(() => {})
  }
  return result
}

/** React to a message with an emoji — instant acknowledgment */
export async function sendReaction(to: string, messageId: string, emoji: string) {
  if (isBlocked(to)) return
  await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: { message_id: messageId, emoji },
  }).catch(() => {})
}

/** Send a list message with sections (up to 10 sections, 10 items each) */
export async function sendListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>,
  header?: string,
  footer?: string,
) {
  if (isBlocked(to)) return { messages: [] }
  const interactive: any = {
    type: 'list',
    body: { text: body },
    action: {
      button: buttonText.slice(0, 20),
      sections: sections.map((s) => ({
        title: s.title.slice(0, 24),
        rows: s.rows.slice(0, 10).map((r) => ({
          id: r.id,
          title: r.title.slice(0, 24),
          description: r.description?.slice(0, 72),
        })),
      })),
    },
  }
  if (header) interactive.header = { type: 'text', text: header }
  if (footer) interactive.footer = { text: footer }

  const result = await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  })
  logApiCall({ provider: 'WHATSAPP', endpoint: '/messages', source: 'WHATSAPP' }).catch(() => {})
  const waMessageId = result?.messages?.[0]?.id
  if (waMessageId) {
    prisma.whatsAppMessage.create({
      data: { waMessageId, phone: to, type: 'OUTBOUND', content: body, status: 'SENT' },
    }).catch(() => {})
  }
  return result
}

/** Send a CTA URL button — tappable link button */
export async function sendCtaUrlMessage(
  to: string,
  body: string,
  buttonText: string,
  url: string,
  header?: string,
  footer?: string,
) {
  if (isBlocked(to)) return { messages: [] }
  const interactive: any = {
    type: 'cta_url',
    body: { text: body },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: buttonText.slice(0, 20),
        url,
      },
    },
  }
  if (header) interactive.header = { type: 'text', text: header }
  if (footer) interactive.footer = { text: footer }

  const result = await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  })
  logApiCall({ provider: 'WHATSAPP', endpoint: '/messages', source: 'WHATSAPP' }).catch(() => {})
  const waMessageId = result?.messages?.[0]?.id
  if (waMessageId) {
    prisma.whatsAppMessage.create({
      data: { waMessageId, phone: to, type: 'OUTBOUND', content: body, status: 'SENT' },
    }).catch(() => {})
  }
  return result
}

/** Send a location message */
export async function sendLocationMessage(to: string, lat: number, lng: number, name?: string, address?: string) {
  if (isBlocked(to)) return { messages: [] }
  return graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'location',
    location: { latitude: lat, longitude: lng, name, address },
  })
}

export async function sendTemplateMessage(to: string, templateName: string, parameters: string[]) {
  if (isBlocked(to)) return { messages: [] }
  const result = await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: parameters.length > 0 ? [
        {
          type: 'body',
          parameters: parameters.map(text => ({ type: 'text', text })),
        },
      ] : [],
    },
  })
  logApiCall({ provider: 'WHATSAPP', endpoint: '/messages/template', source: 'WHATSAPP' }).catch(() => {})
  const waMessageId = result?.messages?.[0]?.id
  if (waMessageId) {
    prisma.whatsAppMessage.create({
      data: { waMessageId, phone: to, type: 'OUTBOUND_TEMPLATE', content: templateName, status: 'SENT' },
    }).catch(() => {})
  }
  return result
}

/**
 * Upload an image to WhatsApp's media API by downloading it first.
 * Returns the media ID, or null if upload fails.
 */
async function uploadImageToWhatsApp(imageUrl: string): Promise<string | null> {
  try {
    const imgRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'image/*',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!imgRes.ok) return null

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    if (buffer.length < 1000 || buffer.length > 5 * 1024 * 1024) return null

    // Upload to WhatsApp Media API
    const form = new FormData()
    form.append('messaging_product', 'whatsapp')
    form.append('type', contentType)
    form.append('file', new Blob([buffer], { type: contentType }), 'product.jpg')

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN()}` },
        body: form,
      }
    )
    if (!uploadRes.ok) return null

    const data = await uploadRes.json()
    return data.id || null
  } catch {
    return null
  }
}

export async function sendImageMessage(to: string, imageUrl: string, caption: string) {
  if (isBlocked(to)) return { messages: [] }

  // Try to upload image first (avoids WhatsApp 131053 media errors)
  const mediaId = await uploadImageToWhatsApp(imageUrl)

  if (!mediaId) {
    // Image couldn't be uploaded — send as text with link instead of risking 131053
    console.log(`[WhatsApp] Image upload failed for ${imageUrl}, falling back to text`)
    return sendTextMessage(to, `${caption}\n\n${imageUrl}`)
  }

  const result = await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { id: mediaId, caption },
  })
  logApiCall({ provider: 'WHATSAPP', endpoint: '/messages', source: 'WHATSAPP' }).catch(() => {})
  const waMessageId = result?.messages?.[0]?.id
  if (waMessageId) {
    prisma.whatsAppMessage.create({
      data: { waMessageId, phone: to, type: 'OUTBOUND', content: caption, status: 'SENT' },
    }).catch(() => {})
  }
  return result
}

const MAX_MEDIA_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
])

export async function downloadMedia(mediaId: string): Promise<Buffer> {
  // Step 1: get the media URL and metadata
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  })
  if (!metaRes.ok) throw new Error(`Failed to get media URL: ${metaRes.status}`)
  const meta = await metaRes.json()
  const { url, file_size, mime_type } = meta

  // Validate file size from metadata
  if (file_size && Number(file_size) > MAX_MEDIA_SIZE) {
    throw new Error(`Media too large: ${file_size} bytes (max ${MAX_MEDIA_SIZE})`)
  }

  // Validate content type from metadata
  if (mime_type && !ALLOWED_MEDIA_TYPES.has(mime_type)) {
    throw new Error(`Unsupported media type: ${mime_type}`)
  }

  // Validate URL is not pointing to internal network
  try {
    const parsedUrl = new URL(url)
    if (isPrivateUrl(parsedUrl)) {
      throw new Error('Invalid media URL: private network')
    }
  } catch (e: any) {
    if (e.message?.includes('private network')) throw e
    throw new Error(`Invalid media URL: ${url}`)
  }

  // Step 2: download the binary with timeout
  const dataRes = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!dataRes.ok) throw new Error(`Failed to download media: ${dataRes.status}`)

  // Double-check content-length header
  const contentLength = dataRes.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_MEDIA_SIZE) {
    throw new Error(`Media too large: ${contentLength} bytes`)
  }

  const arrayBuffer = await dataRes.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_MEDIA_SIZE) {
    throw new Error(`Media too large: ${arrayBuffer.byteLength} bytes`)
  }

  return Buffer.from(arrayBuffer)
}

const MAX_DOC_SIZE = 20 * 1024 * 1024 // 20MB for documents
const ALLOWED_DOC_TYPES = new Set([
  'text/plain', 'application/octet-stream',
  'application/zip', 'application/x-zip-compressed',
])

export async function downloadDocument(mediaId: string): Promise<Buffer> {
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  })
  if (!metaRes.ok) throw new Error(`Failed to get media URL: ${metaRes.status}`)
  const meta = await metaRes.json()
  const { url, file_size, mime_type } = meta

  if (file_size && Number(file_size) > MAX_DOC_SIZE) {
    throw new Error(`Document too large: ${file_size} bytes (max ${MAX_DOC_SIZE})`)
  }

  if (mime_type && !ALLOWED_DOC_TYPES.has(mime_type)) {
    throw new Error(`Unsupported document type: ${mime_type}`)
  }

  try {
    const parsedUrl = new URL(url)
    if (isPrivateUrl(parsedUrl)) throw new Error('Invalid media URL: private network')
  } catch (e: any) {
    if (e.message?.includes('private network')) throw e
    throw new Error(`Invalid media URL: ${url}`)
  }

  const dataRes = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
    signal: AbortSignal.timeout(30000),
  })
  if (!dataRes.ok) throw new Error(`Failed to download document: ${dataRes.status}`)

  const arrayBuffer = await dataRes.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_DOC_SIZE) {
    throw new Error(`Document too large: ${arrayBuffer.byteLength} bytes`)
  }

  return Buffer.from(arrayBuffer)
}

export async function sendContactMessage(to: string) {
  if (isBlocked(to)) return { messages: [] }
  return graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'contacts',
    contacts: [{
      name: { formatted_name: 'Giftist', first_name: 'Giftist' },
      phones: [{ phone: '+15014438478', type: 'WORK' }],
      emails: [{ email: 'hello@giftist.ai', type: 'WORK' }],
      urls: [{ url: 'https://giftist.ai', type: 'WORK' }],
    }],
  })
}

export async function markAsRead(messageId: string) {
  return graphPost('/messages', {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // US number without country code (exactly 10 digits)
  if (digits.length === 10) return '1' + digits
  // Already has country code (11+ digits)
  return digits
}
