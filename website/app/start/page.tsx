import Image from 'next/image'
import { Metadata } from 'next'
import { MessageCircle, ArrowRight, Check, Sparkles, ExternalLink, Clock, Gift } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Find the Perfect Gift in 30 Seconds | Giftist',
  description: 'Curated gift recommendations from our AI concierge. Tell us who you\'re shopping for on WhatsApp and get personalized ideas instantly.',
}

const WHATSAPP_URL = 'https://wa.me/15014438478'

// ── Product catalogs per campaign angle ──

type Product = {
  name: string
  brand: string
  price: string
  image: string
  why: string
  tag?: string
  prompt: string
}

const PRODUCTS: Record<string, { greeting: string; products: Product[] }> = {
  mothers: {
    greeting: "Here are gifts moms are loving right now — picked by our AI concierge:",
    products: [
      {
        name: 'Bold Hoops',
        brand: 'Mejuri',
        price: '$65',
        image: '/gift-hoops.png',
        why: 'Everyday gold hoops she\'ll wear with everything',
        tag: 'Most popular',
        prompt: "I'm interested in the Mejuri Bold Hoops for my mom. Can you find me the best price?",
      },
      {
        name: 'Dewy Skin Set',
        brand: 'Tatcha',
        price: '$68',
        image: '/gift-cream.jpg',
        why: 'A luxury skincare ritual she\'d never buy herself',
        prompt: "I want to get the Tatcha Dewy Skin Set for my mom. Can you help me find it?",
      },
      {
        name: 'Santal 33',
        brand: 'Le Labo',
        price: '$220',
        image: '/gift-perfume.jpg',
        why: 'The iconic scent — woody, warm, unforgettable',
        tag: 'Splurge',
        prompt: "I'm looking at Le Labo Santal 33 for my mom. Can you find the best deal?",
      },
    ],
  },
  birthday: {
    greeting: "Not sure what to get? Here are gifts people love for birthdays — picked by our AI:",
    products: [
      {
        name: 'Kindle Paperwhite',
        brand: 'Amazon',
        price: '$150',
        image: '/prod-candle.png',
        why: 'For the reader who won\'t upgrade themselves',
        tag: 'Best seller',
        prompt: "I'm thinking about a Kindle Paperwhite as a birthday gift. Can you find the best price?",
      },
      {
        name: 'Yeti Rambler 26oz',
        brand: 'YETI',
        price: '$40',
        image: '/prod-ember.png',
        why: 'Keeps drinks ice cold through anything',
        prompt: "I want a Yeti Rambler as a birthday gift. Can you help me find it?",
      },
      {
        name: 'Premium Grilling Set',
        brand: 'Weber',
        price: '$89',
        image: '/prod-spa.png',
        why: 'Elevates every backyard cookout',
        prompt: "Looking for a premium grilling set as a birthday gift. What's the best deal?",
      },
    ],
  },
  default: {
    greeting: "Here are some of our most-recommended gifts this week — picked by our AI concierge:",
    products: [
      {
        name: 'Bold Hoops',
        brand: 'Mejuri',
        price: '$65',
        image: '/gift-hoops.png',
        why: 'Everyday gold hoops — works for anyone',
        tag: 'Trending',
        prompt: "I'm interested in the Mejuri Bold Hoops. Can you find me the best price?",
      },
      {
        name: 'Dewy Skin Set',
        brand: 'Tatcha',
        price: '$68',
        image: '/gift-cream.jpg',
        why: 'Luxury skincare they\'d never buy themselves',
        prompt: "I want to get the Tatcha Dewy Skin Set as a gift. Can you help me find it?",
      },
      {
        name: 'Kindle Paperwhite',
        brand: 'Amazon',
        price: '$150',
        image: '/prod-candle.png',
        why: 'Perfect for the reader in your life',
        tag: 'Best seller',
        prompt: "I'm thinking about a Kindle Paperwhite as a gift. Can you find the best price?",
      },
    ],
  },
}

// ── Campaign config ──

type CampaignConfig = {
  headline: string
  subtext: string
  catalog: string
  heroEmoji: string
}

function getCampaignConfig(utm: string): CampaignConfig {
  if (utm.includes('mothers')) {
    return {
      headline: "Find Mom's\nperfect gift",
      subtext: "Mother's Day is coming up. We picked a few gifts moms are loving — or tell us about yours for something more personal.",
      catalog: 'mothers',
      heroEmoji: '🌸',
    }
  }
  if (utm.includes('forgotgift') || utm.includes('urgency')) {
    return {
      headline: "Birthday tomorrow?\nWe've got you.",
      subtext: "Here are quick picks that always work — or tell us about them for something more personal.",
      catalog: 'birthday',
      heroEmoji: '⏰',
    }
  }
  if (utm.includes('birthday')) {
    return {
      headline: "Never miss a\nbirthday again",
      subtext: "Start with these crowd-pleasers, or tell us about the birthday person for personalized picks.",
      catalog: 'birthday',
      heroEmoji: '🎂',
    }
  }
  if (utm.includes('concierge')) {
    return {
      headline: "Your personal\ngift concierge",
      subtext: "Here's what our AI has been recommending this week — or describe who you're shopping for to get personalized picks.",
      catalog: 'default',
      heroEmoji: '✨',
    }
  }
  if (utm.includes('socialproof')) {
    return {
      headline: "Thousands of gifts\nfound. Zero bad ones.",
      subtext: "Here are this week's most-recommended gifts — or tell us who it's for and we'll find something just for them.",
      catalog: 'default',
      heroEmoji: '⭐',
    }
  }
  if (utm.includes('overthinking')) {
    return {
      headline: "Stop overthinking.\nStart here.",
      subtext: "These are safe bets that work for almost anyone — or tell us about them for something more personal.",
      catalog: 'default',
      heroEmoji: '🧠',
    }
  }
  if (utm.includes('whatsapp')) {
    return {
      headline: "Gift ideas\nin seconds",
      subtext: "Start with these popular picks, or just text us who you're shopping for — no app needed.",
      catalog: 'default',
      heroEmoji: '💬',
    }
  }
  return {
    headline: "Find the perfect gift\nin 30 seconds",
    subtext: "Here are our top picks this week — or tell us who you're shopping for and we'll find something just for them.",
    catalog: 'default',
    heroEmoji: '🎁',
  }
}

// ── Page ──

export default function StartPage({
  searchParams,
}: {
  searchParams: { utm_campaign?: string; utm_source?: string; ref?: string }
}) {
  const utm = searchParams.utm_campaign || ''
  const config = getCampaignConfig(utm)
  const catalog = PRODUCTS[config.catalog] || PRODUCTS.default

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white flex flex-col">
      {/* Nav */}
      <nav className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
          <span className="text-base font-bold">Giftist</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          AI Concierge Online
        </div>
      </nav>

      {/* Hero — compact, headline + subtext only */}
      <div className="px-5 pt-4 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#6C63FF]/15 border border-[#6C63FF]/25 rounded-full mb-6">
          <Sparkles className="h-3 w-3 text-[#6C63FF]" />
          <span className="text-[11px] font-semibold text-[#6C63FF] tracking-wide">Free · No app needed</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.1] mb-3 whitespace-pre-line">
          {config.headline}
        </h1>

        <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-md mx-auto">
          {config.subtext}
        </p>
      </div>

      {/* ── Recommendations section ── */}
      <div className="px-5 pb-4">
        {/* Concierge greeting bubble */}
        <div className="flex gap-2.5 items-start mb-4">
          <div className="w-8 h-8 rounded-full bg-[#6C63FF] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Image src="/logo-light.png" alt="" width={16} height={16} className="rounded-sm" />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
            <p className="text-sm text-gray-300 leading-relaxed">
              {catalog.greeting}
            </p>
          </div>
        </div>

        {/* Product cards */}
        <div className="ml-10 flex gap-3 overflow-x-auto pb-3 -mr-5 pr-5 snap-x scrollbar-hide">
          {catalog.products.map((p) => (
            <a
              key={p.name}
              href={`${WHATSAPP_URL}?text=${encodeURIComponent(p.prompt)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-52 bg-white/[0.07] backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-white/25 hover:bg-white/10 transition-all duration-200 snap-start group"
            >
              <div className="aspect-square bg-white/5 relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-[11px] font-bold text-white px-2.5 py-1 rounded-full">
                  {p.price}
                </div>
                {p.tag && (
                  <div className="absolute top-2 right-2 bg-[#6C63FF] text-[10px] font-bold text-white px-2 py-0.5 rounded-full">
                    {p.tag}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{p.brand}</p>
                <p className="text-sm font-semibold text-white leading-tight mt-0.5">{p.name}</p>
                <p className="text-xs text-gray-400 mt-1 leading-snug">{p.why}</p>
                <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#25D366] group-hover:text-[#30e676]">
                  <MessageCircle className="h-3 w-3" />
                  Get this on WhatsApp
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Follow-up bubble */}
        <div className="flex gap-2.5 items-start mt-4">
          <div className="w-8 h-8 rounded-full bg-[#6C63FF] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Image src="/logo-light.png" alt="" width={16} height={16} className="rounded-sm" />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
            <p className="text-sm text-gray-300 leading-relaxed">
              These are just starting points! Tell me about who you&apos;re shopping for and I&apos;ll find something more personal 👇
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick prompts ── */}
      <div className="px-5 pb-6 ml-10">
        <div className="flex flex-wrap gap-2">
          {getPrompts(config.catalog).map((p) => (
            <a
              key={p.label}
              href={`${WHATSAPP_URL}?text=${encodeURIComponent(p.label)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] bg-white/5 border border-white/10 text-gray-300 px-3.5 py-2 rounded-xl hover:bg-white/10 hover:border-white/20 transition"
            >
              {p.icon} {p.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Primary CTA ── */}
      <div className="px-5 pb-8">
        <a
          href={`${WHATSAPP_URL}?text=${encodeURIComponent(getMainCTA(config.catalog))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-2xl font-semibold text-base transition shadow-lg shadow-[#25D366]/25 w-full"
        >
          <MessageCircle className="h-5 w-5" />
          Tell me who you&apos;re shopping for
        </a>
        <p className="text-center text-xs text-gray-500 mt-2">
          Opens WhatsApp · reply in seconds · free
        </p>
      </div>

      {/* ── How it works ── */}
      <div className="bg-white/[0.03] border-t border-white/10">
        <div className="max-w-lg mx-auto px-5 py-10">
          <h2 className="text-base font-bold text-center mb-6 text-gray-300">How it works</h2>

          <div className="space-y-5">
            <Step number="1" text="Tell us who you're shopping for — their interests, age, the occasion" />
            <Step number="2" text="Our AI finds 3-5 curated gifts with real prices and links" />
            <Step number="3" text="Pick one and we'll send you the best place to buy it" />
          </div>

          {/* Chat mockup */}
          <div className="mt-8 bg-[#0b1a14] rounded-2xl overflow-hidden border border-white/10">
            <div className="bg-[#075e54] px-4 py-2.5 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center">
                <Image src="/logo-light.png" alt="" width={16} height={16} className="rounded-sm" />
              </div>
              <div>
                <p className="text-sm font-semibold">Giftist</p>
                <p className="text-[10px] text-[#80ffb4]">Online</p>
              </div>
            </div>
            <div className="p-3 space-y-2.5">
              <MockBubble side="right" text="My mom loves cooking, budget around $60" />
              <MockBubble side="left" text="Here are 3 great picks for a cooking-loving mom! 🎁" />
              <MockBubble side="left" text={"1. Le Creuset Mini Cocotte Set — $60\n2. Miyabi Chef's Knife — $89\n3. Ottolenghi Flavor Cookbook — $22\n\nWant me to find the best price on any?"} />
              <MockBubble side="right" text="The Le Creuset set!" />
              <MockBubble side="left" text="Found it on Amazon for $54 with free shipping! Here's the link 🔗" />
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <TrustItem icon="✅" text="Free forever" />
            <TrustItem icon="📱" text="No app to download" />
            <TrustItem icon="⚡" text="Reply in seconds" />
            <TrustItem icon="🎁" text="Works for any occasion" />
          </div>

          {/* Social proof */}
          <p className="text-center text-xs text-gray-500 mt-6">
            2,400+ gift recommendations made this week
          </p>

          {/* Final CTA */}
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent(getMainCTA(config.catalog))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-2xl font-semibold text-base transition shadow-lg shadow-[#25D366]/25 w-full"
          >
            <MessageCircle className="h-5 w-5" />
            Start chatting now
          </a>

          <p className="text-center text-xs text-gray-500 mt-6">
            © 2026 Giftist.ai · <a href="/privacy" className="underline">Privacy</a> · <a href="/terms" className="underline">Terms</a>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Prompt chips per catalog ──

function getMainCTA(catalog: string): string {
  if (catalog === 'mothers') {
    return "I need a Mother's Day gift for my mom — she loves "
  }
  if (catalog === 'birthday') {
    return "I need a birthday gift — it's for my "
  }
  return "I need a gift idea — it's for my "
}

function getPrompts(catalog: string) {
  if (catalog === 'mothers') {
    return [
      { icon: '👩‍🍳', label: "Gift for my mom — she loves cooking and gardening" },
      { icon: '💆', label: "Mother's Day gift — she's into skincare and wellness" },
      { icon: '🤷', label: "Mother's Day gift — she's hard to shop for, budget $75" },
      { icon: '🎨', label: "Gift for my mom — she's creative and artsy" },
    ]
  }
  if (catalog === 'birthday') {
    return [
      { icon: '👨', label: "Birthday gift for my dad — he's into tech and outdoors" },
      { icon: '👩', label: "Birthday gift for my best friend — she loves fashion" },
      { icon: '💑', label: "Birthday gift for my partner, budget around $50" },
      { icon: '⏰', label: "I need a birthday gift by this weekend — help!" },
    ]
  }
  return [
    { icon: '🎂', label: "Birthday gift for my sister — she loves cooking" },
    { icon: '💝', label: "Gift for my partner — budget around $50" },
    { icon: '⏰', label: "I need a last-minute gift for a friend" },
    { icon: '💍', label: "Wedding gift for my best friend — budget $100" },
  ]
}

// ── Components ──

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex gap-3.5 items-start">
      <div className="w-7 h-7 rounded-full bg-[#6C63FF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-bold text-[#6C63FF]">{number}</span>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed pt-0.5">{text}</p>
    </div>
  )
}

function TrustItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
      <span className="text-sm">{icon}</span>
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
