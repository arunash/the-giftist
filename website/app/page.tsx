import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { Gift, ArrowRight, Sparkles, MessageCircle, ShoppingBag, Users, Zap } from 'lucide-react'
import { WhatsAppQRBlock } from '@/components/feed/whatsapp-qr'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect('/feed')
  }
  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Floating Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="flex justify-between items-center h-14 px-6 bg-[#141416]/80 backdrop-blur-xl rounded-2xl border border-[#222225]/50 shadow-2xl shadow-black/20">
            <Link href="/" className="flex items-center gap-2">
              <Gift className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-white tracking-tight">The Giftist</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-[#888] hover:text-white transition hidden sm:block"
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Dark gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a06] via-[#0A0A0B] to-[#0d0515]" />
        <div className="absolute top-20 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] bg-amber-900/10 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 pt-36 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-8">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary tracking-wide uppercase">AI-Powered Gift Concierge</span>
              </div>

              <h1 className="text-5xl sm:text-7xl font-bold text-white tracking-tight leading-[1.05] mb-4">
                Make Gifting<br />
                <span className="text-primary">Great Again.</span>
              </h1>

              <p className="text-lg text-[#888] max-w-xl leading-relaxed mb-6">
                Your wishlist lives where your chats do. Just message your Gift Concierge on WhatsApp — send a link, a photo, or just ask.
              </p>

              <div className="space-y-3 mb-8">
                <CheckItem text="Send a link → saved to your list" />
                <CheckItem text="Ask for gift ideas → concierge responds instantly" />
                <CheckItem text="Friends chip in → items get funded" />
                <CheckItem text="Share your list in any group chat" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-primary-hover transition shadow-lg shadow-primary/20"
                >
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center justify-center gap-2 text-white px-8 py-3.5 rounded-xl font-semibold text-base border border-[#333] hover:border-[#555] hover:bg-[#141416] transition"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* WhatsApp QR — above the fold */}
            <div className="flex justify-center">
              <WhatsAppQRBlock />
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-[#1a1a1d]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm text-[#555]">
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Works with every store
            </span>
            <span>No app download needed</span>
            <span>Free forever</span>
            <span>WhatsApp native</span>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="py-24" id="how">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Three ways to build your list
            </h2>
            <p className="text-[#888] max-w-lg mx-auto">
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
      <section className="py-24 border-y border-[#1a1a1d]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-6">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Group Gifting</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                Five friends. One gift.<br />
                <span className="text-[#555]">Zero guesswork.</span>
              </h2>
              <p className="text-[#888] leading-relaxed mb-8">
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
              <div className="bg-[#141416] rounded-2xl border border-[#222225] p-6 w-full max-w-sm">
                <div className="aspect-[4/3] bg-gradient-to-br from-[#1a1a1d] to-[#111] rounded-xl mb-4 flex items-center justify-center">
                  <Gift className="h-12 w-12 text-[#333]" />
                </div>
                <h3 className="font-semibold text-white mb-1">Sony WH-1000XM5</h3>
                <p className="text-sm text-[#666] mb-4">$348.00</p>
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#888]">4 friends contributed</span>
                    <span className="font-semibold text-primary">72%</span>
                  </div>
                  <div className="h-2 bg-[#1a1a1d] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>
                <p className="text-xs text-[#555]">$97.44 to go</p>
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
              <div className="bg-[#141416] rounded-2xl border border-[#222225] w-full max-w-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-[#222225] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Gift Concierge</p>
                    <p className="text-[11px] text-green-400">Online</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <ChatMock role="user" text="I need a birthday gift for my sister, she's into cooking" />
                  <ChatMock role="assistant" text="Great taste runs in the family! I'd go with the Le Creuset Dutch Oven in Marseille — stunning and lasts forever. $350 but your friends can chip in." />
                  <ChatMock role="user" text="Add it to my list" />
                  <ChatMock role="assistant" text="Done! Added Le Creuset Dutch Oven. Want me to find more options at different price points?" />
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full mb-6">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">AI Concierge</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                A personal shopper<br />
                <span className="text-[#555]">that never clocks out.</span>
              </h2>
              <p className="text-[#888] leading-relaxed mb-8">
                Your Gift Concierge learns your taste from everything you save. Ask for gift ideas, get real product recommendations, and add them to your list — all through natural conversation.
              </p>
              <div className="space-y-3">
                <CheckItem text="Knows your taste, budget, and preferences" />
                <CheckItem text="Suggests real products with prices" />
                <CheckItem text="Works on web and WhatsApp" />
                <CheckItem text="Gets smarter the more you use it" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mb-6">
            Stop getting gifts<br />you don't want.
          </h2>
          <p className="text-lg text-[#888] mb-10 max-w-xl mx-auto">
            Create your wishlist in 30 seconds. Share it with the people who care. Actually get the things you love.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-hover transition shadow-lg shadow-primary/20"
          >
            Create your free list
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-xs text-[#555] mt-4">Free forever. No credit card needed.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1d] py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-white">The Giftist</span>
            </div>
            <p className="text-xs text-[#555]">
              © 2026 The Giftist. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FloatingPill({ icon, text, delay }: { icon: React.ReactNode; text: string; delay: string }) {
  return (
    <div
      className="flex items-center gap-2.5 bg-[#141416]/90 backdrop-blur-sm rounded-full px-4 py-2.5 shadow-xl shadow-black/30 border border-[#222225] animate-float"
      style={{ animationDelay: delay }}
    >
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-medium text-white whitespace-nowrap">{text}</span>
    </div>
  )
}

function PillarCard({ number, icon, title, description, color }: {
  number: string; icon: React.ReactNode; title: string; description: string; color: string
}) {
  return (
    <div className="group relative bg-[#141416] rounded-2xl border border-[#222225] p-8 hover:border-[#333] transition-all duration-300">
      <span className="absolute top-6 right-6 text-5xl font-bold text-[#1a1a1d] group-hover:text-[#222] transition">{number}</span>
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${color} mb-5`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-[#888] leading-relaxed">{description}</p>
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
      <span className="text-sm text-[#aaa]">{text}</span>
    </div>
  )
}

function ChatMock({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
        role === 'user'
          ? 'bg-primary text-white rounded-br-md'
          : 'bg-[#1a1a1d] text-[#ccc] rounded-bl-md'
      }`}>
        {text}
      </div>
    </div>
  )
}
