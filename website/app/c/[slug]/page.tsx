import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import { ArrowRight, MessageCircle, Heart, Gift, Sparkles, ChevronDown } from 'lucide-react'
import { prisma } from '@/lib/db'
import { holidaySlugs } from '@/lib/holiday-slugs'
import { seoHolidays } from '@/lib/seo-holidays'

const WHATSAPP_URL = 'https://wa.me/15014438478'
const CHAT_URL = 'https://giftist.ai/chat'

const COLOR_MAP: Record<string, { bg: string; text: string; light: string; border: string; gradient: string; shadow: string; button: string; buttonHover: string }> = {
  pink:    { bg: 'bg-pink-500',    text: 'text-pink-500',    light: 'bg-pink-50',    border: 'border-pink-200', gradient: 'from-pink-50 via-white to-rose-50',       shadow: 'shadow-pink-500/20',    button: 'bg-pink-500',    buttonHover: 'hover:bg-pink-600' },
  blue:    { bg: 'bg-blue-500',    text: 'text-blue-500',    light: 'bg-blue-50',    border: 'border-blue-200', gradient: 'from-blue-50 via-white to-sky-50',        shadow: 'shadow-blue-500/20',    button: 'bg-blue-500',    buttonHover: 'hover:bg-blue-600' },
  rose:    { bg: 'bg-rose-500',    text: 'text-rose-500',    light: 'bg-rose-50',    border: 'border-rose-200', gradient: 'from-rose-50 via-white to-pink-50',       shadow: 'shadow-rose-500/20',    button: 'bg-rose-500',    buttonHover: 'hover:bg-rose-600' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-50 via-white to-green-50', shadow: 'shadow-emerald-600/20', button: 'bg-emerald-600', buttonHover: 'hover:bg-emerald-700' },
  amber:   { bg: 'bg-amber-500',   text: 'text-amber-500',   light: 'bg-amber-50',   border: 'border-amber-200', gradient: 'from-amber-50 via-white to-yellow-50',   shadow: 'shadow-amber-500/20',   button: 'bg-amber-500',   buttonHover: 'hover:bg-amber-600' },
  orange:  { bg: 'bg-orange-500',  text: 'text-orange-500',  light: 'bg-orange-50',  border: 'border-orange-200', gradient: 'from-orange-50 via-white to-amber-50',   shadow: 'shadow-orange-500/20',  button: 'bg-orange-500',  buttonHover: 'hover:bg-orange-600' },
  violet:  { bg: 'bg-violet-500',  text: 'text-violet-500',  light: 'bg-violet-50',  border: 'border-violet-200', gradient: 'from-violet-50 via-white to-purple-50',   shadow: 'shadow-violet-500/20',  button: 'bg-violet-500',  buttonHover: 'hover:bg-violet-600' },
  teal:    { bg: 'bg-teal-500',    text: 'text-teal-500',    light: 'bg-teal-50',    border: 'border-teal-200', gradient: 'from-teal-50 via-white to-cyan-50',       shadow: 'shadow-teal-500/20',    button: 'bg-teal-500',    buttonHover: 'hover:bg-teal-600' },
  red:     { bg: 'bg-red-500',     text: 'text-red-500',     light: 'bg-red-50',     border: 'border-red-200', gradient: 'from-red-50 via-white to-rose-50',         shadow: 'shadow-red-500/20',     button: 'bg-red-500',     buttonHover: 'hover:bg-red-600' },
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

  const prompt = holidaySlugs[params.slug] || ''
  const waLink = `${WHATSAPP_URL}?text=${encodeURIComponent(prompt)}`
  const chatLink = `${CHAT_URL}?q=${encodeURIComponent(prompt)}`
  const c = COLOR_MAP[seo.color] || COLOR_MAP.violet
  const titleLines = seo.title.split('\n')

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
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="flex justify-between items-center h-14 px-6 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl shadow-black/5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
              <span className="text-lg font-bold text-gray-900 tracking-tight">The Giftist</span>
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm font-medium ${c.button} text-white px-5 py-2 rounded-xl ${c.buttonHover} transition`}
            >
              Text Us Now
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient}`} />
        <div className="relative max-w-3xl mx-auto px-6 pt-36 pb-24 text-center">
          {seo.date && (
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${c.bg}/10 border ${c.border} rounded-full mb-8`}>
              <span className="text-base">{seo.emoji}</span>
              <span className={`text-xs font-semibold ${c.text} tracking-wide uppercase`}>{seo.date}</span>
            </div>
          )}

          <h1 className="text-5xl sm:text-7xl font-bold text-gray-900 tracking-tight leading-[1.05] mb-4">
            {titleLines[0]}<br />
            <span className={c.text}>{titleLines[1]}</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed mb-10">
            {seo.heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-2 ${c.button} text-white px-8 py-4 rounded-xl font-semibold text-lg ${c.buttonHover} transition shadow-lg ${c.shadow}`}
            >
              <MessageCircle className="h-5 w-5" />
              {seo.ctaText} on WhatsApp
            </a>
            <Link
              href={chatLink}
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg border border-gray-200 hover:border-gray-300 transition"
            >
              Or use Web Chat
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-4">Free. No app download. No sign-up required.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              How it works
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">Three steps. Under a minute.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <StepCard number="01" title="Text the bot" description="Open WhatsApp and message The Giftist. No app to install, no account to create." color={c} />
            <StepCard number="02" title="Describe the person" description="Tell us what they're into — hobbies, style, budget. Even vague is fine." color={c} />
            <StepCard number="03" title="Get gift suggestions" description="Receive personalized ideas with prices and direct buy links. Add to cart in one tap." color={c} />
          </div>
        </div>
      </section>

      {/* Gift ideas */}
      <section className="py-24 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className={`inline-flex items-center gap-2 px-3 py-1 ${c.bg}/10 border ${c.border} rounded-full mb-6`}>
              <Sparkles className={`h-3.5 w-3.5 ${c.text}`} />
              <span className={`text-xs font-semibold ${c.text} uppercase tracking-wide`}>Popular picks</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Gifts people are loving
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Our concierge finds gifts like these — personalized to the person you're shopping for.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {seo.sampleGifts.map((g) => (
              <GiftCard key={g.name} {...g} color={c} />
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">
            These are examples. Your concierge suggests gifts based on <em>your</em> description.
          </p>
        </div>
      </section>

      {/* FAQ */}
      {seo.faq?.length > 0 && (
        <section className="py-24 border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-12 text-center">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {seo.faq.map((f) => (
                <details key={f.q} className="group bg-white border border-gray-200 rounded-xl">
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                    <span className="text-sm font-semibold text-gray-900 pr-4">{f.q}</span>
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-24 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-6">
            Stop scrolling.<br />
            <span className={c.text}>Start gifting.</span>
          </h2>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            Text our concierge and have the perfect gift picked out in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-2 ${c.button} text-white px-8 py-4 rounded-xl font-semibold text-lg ${c.buttonHover} transition shadow-lg ${c.shadow}`}
            >
              <MessageCircle className="h-5 w-5" />
              {seo.ctaText} Now
              <ArrowRight className="h-5 w-5" />
            </a>
            <Link
              href={chatLink}
              className="inline-flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition text-sm"
            >
              Or use web chat →
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">Free forever. No app download needed.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo-light.png" alt="Giftist" width={22} height={22} className="rounded-md" />
              <span className="text-sm font-semibold text-gray-900">The Giftist</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-900 transition">Terms</Link>
              <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-900 transition">Privacy</Link>
            </div>
            <p className="text-xs text-gray-400">&copy; 2026 Giftist.ai. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function StepCard({ number, title, description, color }: {
  number: string; title: string; description: string; color: { bg: string; text: string; light: string }
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-200 p-8 hover:border-gray-300 transition-all duration-300 shadow-sm">
      <span className="absolute top-6 right-6 text-5xl font-bold text-gray-100 group-hover:text-gray-200 transition">{number}</span>
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${color.light} mb-5`}>
        {number === '01' ? <MessageCircle className={`h-6 w-6 ${color.text}`} /> :
         number === '02' ? <Heart className={`h-6 w-6 ${color.text}`} /> :
         <Gift className={`h-6 w-6 ${color.text}`} />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}

function GiftCard({ name, subtitle, price, tag, color }: {
  name: string; subtitle: string; price: string; tag: string; color: { light: string; text: string; border: string }
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:${color.border} transition`}>
      <div className={`aspect-square ${color.light} rounded-xl mb-4 flex items-center justify-center`}>
        <Gift className={`h-10 w-10 ${color.text} opacity-40`} />
      </div>
      <p className={`text-[10px] ${color.text} font-semibold uppercase tracking-wider mb-1`}>{tag}</p>
      <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{name}</h3>
      <p className="text-xs text-gray-400 mb-2">{subtitle}</p>
      <p className="text-sm font-semibold text-gray-900">{price}</p>
    </div>
  )
}
