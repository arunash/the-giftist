import { logApiCall } from '@/lib/api-logger'

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
  return result
}

export async function downloadMedia(mediaId: string): Promise<Buffer> {
  // Step 1: get the media URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  })
  if (!metaRes.ok) throw new Error(`Failed to get media URL: ${metaRes.status}`)
  const { url } = await metaRes.json()

  // Step 2: download the binary
  const dataRes = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  })
  if (!dataRes.ok) throw new Error(`Failed to download media: ${dataRes.status}`)
  const arrayBuffer = await dataRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
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
