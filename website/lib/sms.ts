import twilio from 'twilio'
import { logApiCall } from './api-logger'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const FROM = process.env.TWILIO_PHONE_NUMBER || '+15014438478'

export async function sendSms(to: string, body: string): Promise<void> {
  const toFormatted = to.startsWith('+') ? to : `+${to}`

  await client.messages.create({
    to: toFormatted,
    from: FROM,
    body,
  })

  logApiCall({
    provider: 'TWILIO',
    endpoint: 'messages/sms',
    source: 'NUDGE',
  }).catch(() => {})
}
