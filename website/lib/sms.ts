import twilio from 'twilio'
import { logApiCall } from './api-logger'
import { prisma } from './db'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const FROM = process.env.TWILIO_PHONE_NUMBER || '+15014438478'

// Phone numbers that must never receive SMS
const SMS_BLOCKLIST = new Set([
  '15550000000',
])

export async function sendSms(to: string, body: string): Promise<void> {
  const toFormatted = to.startsWith('+') ? to : `+${to}`
  const phone = to.replace(/^\+/, '')

  if (SMS_BLOCKLIST.has(phone)) {
    console.log(`[SMS] Blocked: ${phone} is on the blocklist`)
    return
  }

  const msg = await client.messages.create({
    to: toFormatted,
    from: FROM,
    body,
  })

  // Log SMS to WhatsAppMessage table so it shows in admin
  prisma.whatsAppMessage.create({
    data: {
      waMessageId: msg.sid || `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phone,
      type: 'SMS_OUTBOUND',
      content: body,
      status: 'SENT',
    },
  }).catch(() => {})

  logApiCall({
    provider: 'TWILIO',
    endpoint: 'messages/sms',
    source: 'NUDGE',
  }).catch(() => {})
}
