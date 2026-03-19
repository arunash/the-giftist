import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

const WHATSAPP_URL = 'https://wa.me/15014438478'

export const metadata = {
  title: 'Chat with Giftist',
  description: 'Connect with your Gift Concierge on WhatsApp for personalized gift recommendations.',
}

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: { ref?: string; text?: string }
}) {
  const ref = searchParams.ref || 'direct'
  const text = searchParams.text || ''

  // Log the click for analytics
  const headerList = await headers()
  const ua = headerList.get('user-agent') || ''
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

  // Fire-and-forget analytics
  prisma.whatsAppMessage.create({
    data: {
      waMessageId: `redirect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phone: 'redirect',
      type: 'REDIRECT',
      content: JSON.stringify({ ref, text, ua: ua.slice(0, 200), ip }),
      status: 'CLICKED',
    },
  }).catch(() => {})

  const waUrl = text
    ? `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`
    : WHATSAPP_URL

  redirect(waUrl)
}
