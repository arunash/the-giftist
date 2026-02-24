import { logApiCall } from '@/lib/api-logger'
import { prisma } from './db'
import { isPrivateUrl } from './url-safety'

const GRAPH_API = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`
const TOKEN = () => process.env.WHATSAPP_ACCESS_TOKEN!

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

export async function sendTemplateMessage(to: string, templateName: string, parameters: string[]) {
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

export async function sendImageMessage(to: string, imageUrl: string, caption: string) {
  const result = await graphPost('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
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

export async function sendContactMessage(to: string) {
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
