import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const { data, error } = await getResend().emails.send({
    from: 'Giftist <digest@giftist.ai>',
    to,
    subject,
    html,
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
  return data
}
