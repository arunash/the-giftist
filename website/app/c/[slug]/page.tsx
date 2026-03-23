import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { holidaySlugs } from '@/lib/holiday-slugs'

const WHATSAPP_URL = 'https://wa.me/15014438478'

export default async function SlugRedirectPage({
  params,
}: {
  params: { slug: string }
}) {
  const prompt = holidaySlugs[params.slug]
  if (!prompt) notFound()

  // Log the click for analytics
  const headerList = await headers()
  const ua = headerList.get('user-agent') || ''
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

  prisma.whatsAppMessage.create({
    data: {
      waMessageId: `redirect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phone: 'redirect',
      type: 'REDIRECT',
      content: JSON.stringify({ slug: params.slug, ua: ua.slice(0, 200), ip }),
      status: 'CLICKED',
    },
  }).catch(() => {})

  redirect(`${WHATSAPP_URL}?text=${encodeURIComponent(prompt)}`)
}
