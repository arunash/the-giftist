import Image from 'next/image'
import { Metadata } from 'next'
import { MessageCircle, ArrowRight, Check, Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Find the Perfect Gift in 30 Seconds | Giftist',
  description: 'Tell our AI concierge who you\'re shopping for. Get personalized gift ideas instantly on WhatsApp. Free, no app needed.',
}

const WHATSAPP_URL = 'https://wa.me/15014438478'

const PROMPTS = [
  { label: "My mom's birthday is coming up", icon: "🎂" },
  { label: "Gift for my partner, budget $50", icon: "💝" },
  { label: "Need a last-minute gift idea", icon: "⏰" },
  { label: "Wedding gift for my best friend", icon: "💍" },
]

export default function StartPage({
  searchParams,
}: {
  searchParams: { utm_campaign?: string; utm_source?: string; ref?: string }
}) {
  const utm = searchParams.utm_campaign || ''

  // Customize headline based on ad campaign
  let headline = "Find the perfect gift\nin 30 seconds"
  let subtext = "Tell our AI concierge who you're shopping for. Get curated gift ideas instantly — on WhatsApp."

  if (utm.includes('forgotgift') || utm.includes('urgency')) {
    headline = "Birthday tomorrow?\nWe've got you."
    subtext = "Tell us who it's for and your budget. We'll find the perfect gift in 30 seconds — on WhatsApp."
  } else if (utm.includes('concierge')) {
    headline = "Your personal\ngift concierge"
    subtext = "Describe who you're shopping for. Get personalized gift ideas from our AI — instantly on WhatsApp."
  } else if (utm.includes('birthday')) {
    headline = "Never miss a\nbirthday again"
    subtext = "Tell us about the people you love. We'll help you find the perfect gift every time — on WhatsApp."
  } else if (utm.includes('socialproof')) {
    headline = "Thousands of gifts\nfound. Zero bad ones."
    subtext = "Tell our AI concierge who you're shopping for. Birthdays, holidays, weddings — we've got you."
  } else if (utm.includes('mothers')) {
    headline = "Find Mom's\nperfect gift"
    subtext = "Tell us about your mom — her hobbies, style, interests — and we'll find something she'll love. In 30 seconds on WhatsApp."
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
          <span className="text-base font-bold">Giftist</span>
        </div>
        <span className="text-xs text-gray-500">AI Gift Concierge</span>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
        <div className="max-w-lg w-full text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#6C63FF]/15 border border-[#6C63FF]/25 rounded-full mb-8">
            <Sparkles className="h-3.5 w-3.5 text-[#6C63FF]" />
            <span className="text-xs font-semibold text-[#6C63FF] tracking-wide">Free &middot; No app needed</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-5 whitespace-pre-line">
            {headline}
          </h1>

          <p className="text-base sm:text-lg text-gray-400 leading-relaxed mb-10 max-w-md mx-auto">
            {subtext}
          </p>

          {/* Primary CTA — WhatsApp */}
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("Hi! I need help finding a gift")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-2xl font-semibold text-lg transition shadow-lg shadow-[#25D366]/25 w-full sm:w-auto"
          >
            <MessageCircle className="h-5 w-5" />
            Text us on WhatsApp
          </a>

          <p className="text-xs text-gray-500 mt-3">
            Opens WhatsApp — reply in seconds, not hours
          </p>

          {/* Quick prompts */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {PROMPTS.map((p) => (
              <a
                key={p.label}
                href={`${WHATSAPP_URL}?text=${encodeURIComponent(p.label)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm bg-white/5 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl hover:bg-white/10 hover:border-white/20 transition"
              >
                {p.icon} {p.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="bg-white/5 border-t border-white/10">
        <div className="max-w-lg mx-auto px-6 py-12">
          <h2 className="text-lg font-bold text-center mb-8">Here&apos;s what happens when you text us</h2>

          <div className="space-y-6">
            <Step number="1" text="Tell us who you're shopping for — their interests, age, the occasion" />
            <Step number="2" text="Our AI concierge finds 3-5 curated gifts that actually fit" />
            <Step number="3" text="Pick one, and we'll send you the best link to buy it" />
          </div>

          {/* Chat mockup */}
          <div className="mt-10 bg-[#0b1a14] rounded-2xl overflow-hidden border border-white/10">
            <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                <Image src="/logo-light.png" alt="" width={18} height={18} className="rounded-sm" />
              </div>
              <div>
                <p className="text-sm font-semibold">Giftist</p>
                <p className="text-[11px] text-[#80ffb4]">Online</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <MockBubble side="right" text="My mom's birthday is next week, she loves cooking" />
              <MockBubble side="left" text="I've got 3 great options for a cooking-loving mom! 🎁" />
              <MockBubble side="left" text="1. Le Creuset Mini Cocotte Set — $60
2. Miyabi Chef's Knife — $89
3. Ottolenghi Flavor Cookbook — $22

Want me to find the best price on any of these?" />
              <MockBubble side="right" text="The knife! Can you find it for me?" />
              <MockBubble side="left" text="Found it on Amazon for $79 with free Prime shipping! Here's the link 🔗" />
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            <TrustItem text="Free forever — no credit card" />
            <TrustItem text="No app to download" />
            <TrustItem text="Reply in seconds, not hours" />
            <TrustItem text="Works for any occasion" />
          </div>

          {/* Final CTA */}
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("Hi! I need help finding a gift")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-2xl font-semibold text-lg transition shadow-lg shadow-[#25D366]/25 w-full"
          >
            <MessageCircle className="h-5 w-5" />
            Start chatting now
          </a>

          <p className="text-center text-xs text-gray-500 mt-8">
            © 2026 Giftist.ai &middot; <a href="/privacy" className="underline">Privacy</a> &middot; <a href="/terms" className="underline">Terms</a>
          </p>
        </div>
      </div>
    </div>
  )
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-[#6C63FF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-sm font-bold text-[#6C63FF]">{number}</span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed pt-1">{text}</p>
    </div>
  )
}

function TrustItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check className="h-4 w-4 text-[#25D366] flex-shrink-0" />
      <span className="text-xs text-gray-400">{text}</span>
    </div>
  )
}

function MockBubble({ side, text }: { side: 'left' | 'right'; text: string }) {
  return (
    <div className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line ${
          side === 'right'
            ? 'bg-[#005c4b] text-white rounded-br-sm'
            : 'bg-[#1a2e23] text-gray-200 rounded-bl-sm'
        }`}
      >
        {text}
      </div>
    </div>
  )
}
