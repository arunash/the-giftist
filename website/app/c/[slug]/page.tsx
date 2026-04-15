import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import { ArrowRight, Send, ExternalLink } from 'lucide-react'
import { prisma } from '@/lib/db'
import { holidaySlugs } from '@/lib/holiday-slugs'
import { seoHolidays, type HolidaySeo } from '@/lib/seo-holidays'

const WHATSAPP_URL = 'https://wa.me/15014438478'

// Curated products per holiday — shown as "concierge picks" in the chat UI
// Each links to /chat?q=... which gates on signup, then auto-sends the message
const HOLIDAY_PRODUCTS: Record<string, Array<{
  name: string
  brand: string
  price: string
  image: string
  why: string
  chatPrompt: string
}>> = {
  'mothers-day': [
    {
      name: 'Ember Mug 2',
      brand: 'Ember',
      price: '$129.95',
      image: '/prod-ember.jpg',
      why: 'Keeps her coffee at the perfect temperature all morning',
      chatPrompt: "I'm interested in the Ember Mug 2 for my mom for Mother's Day. Can you find me the best deal?",
    },
    {
      name: 'Birthdate Candle',
      brand: 'Birthdate Co.',
      price: '$48',
      image: '/prod-candle.jpg',
      why: 'A candle personalized to her exact birthday — scent, tarot card, and all',
      chatPrompt: "I want to get a Birthdate Candle for my mom for Mother's Day. Can you help me find it?",
    },
    {
      name: 'Luxe Spa Gift Set',
      brand: 'Herbivore Botanicals',
      price: '$68',
      image: '/prod-spa.jpg',
      why: 'A full self-care ritual she\'d never buy herself',
      chatPrompt: "I'm looking at the Herbivore Botanicals spa gift set for my mom. Can you find a good link?",
    },
  ],
  'fathers-day': [
    {
      name: 'Yeti Rambler 26oz',
      brand: 'YETI',
      price: '$40',
      image: '/prod-ember.jpg',
      why: 'Keeps drinks ice-cold through any adventure',
      chatPrompt: "I want the Yeti Rambler for my dad for Father's Day. Can you find the best price?",
    },
    {
      name: 'Kindle Paperwhite',
      brand: 'Amazon',
      price: '$149.99',
      image: '/prod-candle.jpg',
      why: 'For the dad who reads but won\'t upgrade himself',
      chatPrompt: "I'm interested in a Kindle Paperwhite for my dad for Father's Day. Help me find it?",
    },
    {
      name: 'Premium Grilling Set',
      brand: 'Weber',
      price: '$89',
      image: '/prod-spa.jpg',
      why: 'Elevates every backyard cookout',
      chatPrompt: "I want a premium grilling set for my dad for Father's Day. Can you help?",
    },
  ],
}

// ── Metadata ──
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const seo = seoHolidays[params.slug]
  if (!seo) return {}

  return {
    title: seo.metaTitle + ' | Giftist',
    description: seo.description,
    openGraph: {
      title: seo.metaTitle + ' | Giftist',
      description: seo.description,
      url: `https://giftist.ai/c/${seo.slug}`,
      type: 'website',
    },
    alternates: {
      canonical: `https://giftist.ai/c/${seo.slug}`,
    },
  }
}

// ── Page ──
export default async function SlugPage({ params }: { params: { slug: string } }) {
  const seo = seoHolidays[params.slug]

  // If no SEO content, fall back to WhatsApp redirect
  if (!seo) {
    const prompt = holidaySlugs[params.slug]
    if (!prompt) notFound()

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

  // Log the visit
  const headerList = await headers()
  const ua = headerList.get('user-agent') || ''
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  prisma.whatsAppMessage.create({
    data: {
      waMessageId: `seo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phone: 'seo-landing',
      type: 'REDIRECT',
      content: JSON.stringify({ slug: params.slug, ua: ua.slice(0, 200), ip }),
      status: 'CLICKED',
    },
  }).catch(() => {})

  const products = HOLIDAY_PRODUCTS[params.slug]
  const hasProducts = products && products.length > 0

  // Schema.org structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seo.metaTitle,
    description: seo.description,
    url: `https://giftist.ai/c/${seo.slug}`,
    provider: {
      '@type': 'Organization',
      name: 'Giftist',
      url: 'https://giftist.ai',
    },
    ...(seo.faq?.length ? {
      mainEntity: seo.faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    } : {}),
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Minimal Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">The Giftist</span>
          </Link>
          <span className="text-xs text-gray-400">AI Gift Concierge</span>
        </div>
      </nav>

      {/* Chat-style body */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Bot greeting */}
        <ChatBubble>
          <p className="text-sm text-gray-700 leading-relaxed">
            Hey! {seo.emoji} {seo.date && <span className="font-semibold">{seo.date.split(',')[0]}</span>}{seo.date && " is coming up. "}
            I found a few gifts that moms are loving right now — take a look:
          </p>
        </ChatBubble>

        {/* Product cards */}
        {hasProducts && (
          <div className="ml-10 flex gap-3 overflow-x-auto pb-2 -mr-4 pr-4 snap-x">
            {products.map((p) => (
              <Link
                key={p.name}
                href={`/login?q=${encodeURIComponent(p.chatPrompt)}`}
                className="flex-shrink-0 w-56 bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-200 snap-start group"
              >
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-900 px-2 py-0.5 rounded-full">
                    {p.price}
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{p.brand}</p>
                  <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{p.why}</p>
                  <div className="flex items-center gap-1 mt-2.5 text-xs font-semibold text-pink-500 group-hover:text-pink-600">
                    View &amp; Buy
                    <ExternalLink className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Bot follow-up */}
        <ChatBubble>
          <p className="text-sm text-gray-700 leading-relaxed">
            These are just starting points! Tell me a bit about your mom — what does she love? What&apos;s she into? — and I&apos;ll find something even more personal.
          </p>
        </ChatBubble>

        {/* Suggestion chips */}
        <div className="ml-10 flex flex-wrap gap-2">
          {[
            "My mom loves cooking and gardening",
            "She's into skincare and wellness",
            "She's hard to shop for",
            "Budget is under $75",
          ].map((chip) => (
            <Link
              key={chip}
              href={`/login?q=${encodeURIComponent(chip)}`}
              className="text-xs bg-white border border-gray-200 text-gray-600 px-3.5 py-2 rounded-full hover:bg-gray-50 hover:border-gray-300 transition"
            >
              {chip}
            </Link>
          ))}
        </div>

        {/* Social proof */}
        <div className="ml-10 mt-2">
          <p className="text-[11px] text-gray-400">
            2,400+ gift recommendations made this week
          </p>
        </div>

        {/* Spacer for input bar */}
        <div className="h-20" />
      </div>

      {/* Fixed input bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
        <div className="max-w-2xl mx-auto">
          <Link
            href={`/login?q=${encodeURIComponent(`I need ${seo.ctaText?.toLowerCase() || 'gift'} ideas`)}`}
            className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 hover:bg-gray-100 hover:border-gray-300 transition group"
          >
            <span className="flex-1 text-sm text-gray-400 group-hover:text-gray-500">
              Tell me about who you&apos;re shopping for...
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 hidden sm:block">Free</span>
              <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center group-hover:bg-gray-800">
                <Send className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* FAQ section (good for SEO) */}
      {seo.faq?.length > 0 && (
        <div className="bg-white border-t border-gray-200 pb-24">
          <div className="max-w-2xl mx-auto px-4 py-12">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Frequently asked questions</h2>
            <div className="space-y-4">
              {seo.faq.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-gray-900 py-2">
                    {f.q}
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0 ml-4" />
                  </summary>
                  <p className="text-sm text-gray-500 leading-relaxed pb-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Image src="/logo-light.png" alt="" width={18} height={18} className="rounded-sm" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-md border border-gray-200 px-4 py-3 max-w-[85%] shadow-sm">
        {children}
      </div>
    </div>
  )
}
