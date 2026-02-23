import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { ArrowRight, Sparkles, MessageCircle, Users, Zap, Crown, Check, X } from 'lucide-react'
import Image from 'next/image'
import { WhatsAppQRBlock } from '@/components/feed/whatsapp-qr'
import { HeroChatInput } from '@/components/landing/hero-chat-input'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect('/feed')
  }
  return (
    <div className="min-h-screen bg-background">
      {/* Floating Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="flex justify-between items-center h-14 px-6 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl shadow-black/5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
              <span className="text-lg font-bold text-gray-900 tracking-tight">The Giftist</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-gray-500 hover:text-gray-900 transition hidden sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium bg-primary text-white px-5 py-2 rounded-xl hover:bg-primary-hover transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero — chat-first */}
      <section className="relative overflow-hidden">
        {/* Light gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-[#F9FAFB] to-violet-50" />
        <div className="absolute top-20 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] bg-amber-100/30 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-6 pt-36 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-8">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">AI-Powered Gift Concierge</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold text-gray-900 tracking-tight leading-[1.05] mb-4">
            Who are you<br />
            <span className="text-primary">shopping for?</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed mb-10">
            Tell your Gift Concierge what you need. It handles the rest.
          </p>

          <HeroChatInput />

          {/* Desktop: QR code */}
          <div className="mt-12 hidden lg:flex justify-center">
            <WhatsAppQRBlock />
          </div>

          {/* Mobile: WhatsApp button */}
          <a
            href="https://wa.me/15014438478?text=Hi!"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 lg:hidden inline-flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold text-base hover:bg-green-700 transition"
          >
            <MessageCircle className="h-5 w-5" />
            Start on WhatsApp
          </a>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Works with every store
            </span>
            <span>No app download needed</span>
            <span>Free forever</span>
            <span>WhatsApp native</span>
          </div>
          <div className="flex justify-center mt-4">
            <a href="https://www.producthunt.com/products/the-giftist-ai-concierge?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-the-giftist-ai-concierge" target="_blank" rel="noopener noreferrer">
              <img alt="The Giftist - AI Concierge - Your personal gift concierge | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1084035&theme=light&t=1771814629404" />
            </a>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="py-24" id="how">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Three ways to build your list
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Save products however you want. Your Gift Concierge handles the rest.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <PillarCard
              number="01"
              icon={<Zap className="h-6 w-6" />}
              title="Send a link"
              description="Paste any product URL — from Amazon, Nike, Etsy, anywhere. We extract the name, image, and price automatically."
              color="bg-orange-500/10 text-orange-400"
            />
            <PillarCard
              number="02"
              icon={<MessageCircle className="h-6 w-6" />}
              title="Message on WhatsApp"
              description="Text your Gift Concierge a link, photo, or just describe what you want. It gets added to your list instantly."
              color="bg-green-500/10 text-green-400"
            />
            <PillarCard
              number="03"
              icon={<Sparkles className="h-6 w-6" />}
              title="Ask the Concierge"
              description="Not sure what you want? Your AI concierge knows your taste and suggests things you'll love."
              color="bg-violet-500/10 text-violet-400"
            />
          </div>
        </div>
      </section>

      {/* Feature split — Group Gifting */}
      <section className="py-24 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-6">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Group Gifting</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
                Five friends. One gift.<br />
                <span className="text-gray-400">Zero guesswork.</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Instead of five people buying five random $20 gifts, they chip in $20 each toward the $100 thing you actually want. Share your wishlist and watch items get funded.
              </p>
              <div className="space-y-3">
                <CheckItem text="Friends contribute any amount toward items" />
                <CheckItem text="Progress bars show funding status" />
                <CheckItem text="Share via WhatsApp with one tap" />
                <CheckItem text="Works for birthdays, weddings, holidays" />
              </div>
            </div>

            {/* Mock funding card */}
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm shadow-sm">
                <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl mb-4 overflow-hidden">
                  <img src="/mock-sony-wh1000xm5.jpg" alt="Sony WH-1000XM5" className="w-full h-full object-cover" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Sony WH-1000XM5</h3>
                <p className="text-sm text-gray-400 mb-4">$348.00</p>
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">4 friends contributed</span>
                    <span className="font-semibold text-primary">72%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">$97.44 to go</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Concierge showcase */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Mock chat */}
            <div className="order-2 lg:order-1 flex justify-center">
              <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Gift Concierge</p>
                    <p className="text-[11px] text-green-400">Online</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <ChatMock role="user" text="Birthday gift for my sister — she loves cooking" />
                  <ChatMock role="assistant" text="I'd go with the Le Creuset Dutch Oven in Marseille — stunning and lasts forever. $350 but your friends can chip in." />
                  <ChatMock role="user" text="Add it to my list!" />
                </div>
                {/* Input composer */}
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2.5">
                    <span className="text-[13px] text-gray-400 flex-1">Ask your concierge anything...</span>
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
                A personal shopper<br />
                <span className="text-gray-400">that never clocks out.</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Tell it who you're shopping for. It suggests real products you can add to your list in one tap.
              </p>
              <div className="space-y-3">
                <CheckItem text="Real product suggestions with prices" />
                <CheckItem text="Works on web and WhatsApp" />
                <CheckItem text="Learns your taste over time" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing: Free vs Gold */}
      <section className="py-24 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Free forever. Gold when you're ready.
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Everything you need to get started is free. Upgrade to Gold for the full concierge experience.
            </p>
          </div>

          {/* AI nudge */}
          <div className="ai-suggestion-card max-w-3xl mx-auto mb-8 p-5 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <span className="ai-badge mb-2"><Sparkles className="h-3 w-3 inline -mt-0.5 mr-1" />AI Insight</span>
                <p className="text-sm text-gray-600 mt-2">
                  Most gift-givers have 3+ events a year. Gold members never hit the concierge limit when it matters most.
                </p>
              </div>
              <a href="#gold" className="chip chip--filled whitespace-nowrap self-start">
                See what Gold unlocks →
              </a>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free tier */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Free</h3>
              <p className="text-gray-500 text-sm mb-6">Everything to get started</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-3xl font-bold text-gray-900">$0</span>
                <span className="text-sm text-gray-400">/forever</span>
              </div>
              <div className="space-y-3">
                <PricingItem included text="Unlimited wishlist items" />
                <PricingItem included text="Add items by URL or photo" />
                <PricingItem included text="Share lists via WhatsApp" />
                <PricingItem included text="Create events and registries" />
                <PricingItem included text="Group gift funding" />
                <PricingItem included text="10 concierge messages/day" />
                <PricingItem included={false} text="Unlimited concierge conversations" />
                <PricingItem included={false} text="Priority AI recommendations" />
                <PricingItem included={false} text="Early access to new features" />
              </div>
              <Link
                href="/login"
                className="mt-8 w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-gray-900 border border-gray-300 hover:border-gray-400 hover:bg-gray-100 transition"
              >
                Get Started Free
              </Link>
            </div>

            {/* Gold tier */}
            <div id="gold" className="bg-white rounded-2xl border border-yellow-500/30 p-8 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                Popular
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-5 w-5 text-yellow-500" />
                <h3 className="text-xl font-bold text-gray-900">Gold</h3>
              </div>
              <p className="text-gray-500 text-sm mb-6">The full concierge experience</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-3xl font-bold text-gray-900">$4.99</span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              <div className="space-y-3">
                <PricingItem included text="Everything in Free" />
                <PricingItem included text="Unlimited concierge conversations" />
                <PricingItem included text="Priority AI recommendations" />
                <PricingItem included text="Daily WhatsApp gift inspiration" />
                <PricingItem included text="Early access to new features" />
              </div>
              <Link
                href="/login"
                className="mt-8 w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm bg-yellow-500 text-black hover:bg-yellow-400 transition"
              >
                <Crown className="h-4 w-4" />
                Start Gold Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-6">
            Stop getting gifts<br />you don't want.
          </h2>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            Create your wishlist in 30 seconds. Share it with the people who care. Actually get the things you love.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-hover transition shadow-lg shadow-primary/20"
          >
            Create your free list
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-xs text-gray-400 mt-4">Free forever. No credit card needed.</p>
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
              <Link href="/about" className="text-xs text-gray-400 hover:text-gray-900 transition">About</Link>
            </div>
            <p className="text-xs text-gray-400 mt-3 sm:mt-0">
              © 2026 Giftist.ai. All rights reserved. A product of North Beach Technologies LLC.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function PillarCard({ number, icon, title, description, color }: {
  number: string; icon: React.ReactNode; title: string; description: string; color: string
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-200 p-8 hover:border-gray-300 transition-all duration-300 shadow-sm">
      <span className="absolute top-6 right-6 text-5xl font-bold text-gray-100 group-hover:text-gray-200 transition">{number}</span>
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${color} mb-5`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-sm text-gray-600">{text}</span>
    </div>
  )
}

function PricingItem({ included, text }: { included: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3">
      {included ? (
        <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
          <Check className="h-3 w-3 text-green-400" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <X className="h-3 w-3 text-gray-300" />
        </div>
      )}
      <span className={`text-sm ${included ? 'text-gray-600' : 'text-gray-400'}`}>{text}</span>
    </div>
  )
}

function ChatMock({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
        role === 'user'
          ? 'bg-primary text-white rounded-br-md'
          : 'bg-gray-100 text-gray-700 rounded-bl-md'
      }`}>
        {text}
      </div>
    </div>
  )
}
