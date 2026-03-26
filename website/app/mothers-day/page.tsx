import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MessageCircle, Heart, Gift, Sparkles, Search } from 'lucide-react'

const WA_LINK = 'https://wa.me/15014438478?text=I%20need%20a%20Mother%27s%20Day%20gift'

export const metadata = {
  title: "Mother's Day Gifts — Found in 30 Seconds | Giftist",
  description: "Tell our AI concierge about your mom and get personalized Mother's Day gift suggestions instantly. Works over WhatsApp.",
  openGraph: {
    title: "Mother's Day Gifts — Found in 30 Seconds | Giftist",
    description: "Tell our AI concierge about your mom and get personalized gift suggestions instantly.",
    url: 'https://giftist.ai/mothers-day',
  },
}

export default function MothersDay() {
  redirect(WA_LINK)

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
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium bg-pink-500 text-white px-5 py-2 rounded-xl hover:bg-pink-600 transition"
            >
              Text Us Now
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-[#F9FAFB] to-rose-50" />
        <div className="absolute top-20 -right-40 w-[600px] h-[600px] bg-pink-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] bg-rose-100/30 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-6 pt-36 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-pink-500/10 border border-pink-500/20 rounded-full mb-8">
            <Heart className="h-3.5 w-3.5 text-pink-500" />
            <span className="text-xs font-semibold text-pink-500 tracking-wide uppercase">Mother's Day — May 11, 2026</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold text-gray-900 tracking-tight leading-[1.05] mb-4">
            The perfect gift<br />
            for Mom — <span className="text-pink-500">found in<br />30 seconds</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed mb-10">
            Tell our AI Gift Concierge a little about your mom and get personalized gift suggestions with buy links — instantly, over WhatsApp.
          </p>

          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-pink-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-pink-600 transition shadow-lg shadow-pink-500/20"
          >
            <MessageCircle className="h-5 w-5" />
            Find Mom's Gift on WhatsApp
          </a>

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
            <p className="text-gray-500 max-w-lg mx-auto">
              Three steps to a gift she'll actually love.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <StepCard
              number="01"
              icon={<MessageCircle className="h-6 w-6" />}
              title="Text the bot"
              description="Open WhatsApp and send a message to The Giftist. No app to install, no account to create."
              color="bg-green-500/10 text-green-400"
            />
            <StepCard
              number="02"
              icon={<Heart className="h-6 w-6" />}
              title="Describe your mom"
              description={`Tell us what she's into — "My mom loves cooking and gardening" or "Gift for mom under $75, she's into yoga."`}
              color="bg-pink-500/10 text-pink-400"
            />
            <StepCard
              number="03"
              icon={<Gift className="h-6 w-6" />}
              title="Get gift suggestions"
              description="Receive personalized gift ideas with prices and direct buy links. Add to cart in one tap."
              color="bg-rose-500/10 text-rose-400"
            />
          </div>
        </div>
      </section>

      {/* Gift ideas showcase */}
      <section className="py-24 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full mb-6">
              <Sparkles className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-xs font-semibold text-pink-400 uppercase tracking-wide">Popular picks</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Gifts moms are loving this year
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Our concierge has helped hundreds of people find the right gift. Here are some favorites.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <GiftCard
              name="Le Creuset Dutch Oven"
              subtitle="Marseille Blue, 5.5 Qt"
              price="$350"
              tag="For the home chef"
            />
            <GiftCard
              name="Dyson Airwrap"
              subtitle="Multi-Styler Complete"
              price="$500"
              tag="For the style-conscious"
            />
            <GiftCard
              name="Herbivore Botanicals Set"
              subtitle="Luxury Spa Gift Set"
              price="$68"
              tag="For the self-care lover"
            />
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            These are just examples. Your concierge suggests gifts based on <em>your</em> mom's personality and interests.
          </p>
        </div>
      </section>

      {/* Mock chat */}
      <section className="py-24 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
                    <Heart className="h-4 w-4 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Gift Concierge</p>
                    <p className="text-[11px] text-green-400">Online</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <ChatBubble role="user" text="I need a Mother's Day gift" />
                  <ChatBubble role="assistant" text="I'd love to help! Tell me about your mom — what does she enjoy? Any hobbies, interests, or things she's mentioned wanting?" />
                  <ChatBubble role="user" text="She loves cooking and spending time in her garden" />
                  <ChatBubble role="assistant" text="Great taste! I'd suggest the Le Creuset Dutch Oven in Marseille ($350) — beautiful and lasts forever. Or the Veradek raised garden bed ($89) for her outdoor time. Want me to find more options?" />
                </div>
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2.5">
                    <span className="text-[13px] text-gray-400 flex-1">Tell us about your mom...</span>
                    <div className="w-7 h-7 rounded-lg bg-pink-500 flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
                Like texting a friend<br />
                <span className="text-gray-400">who knows every store.</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Just describe your mom in your own words. The concierge finds real products from real stores, with prices and buy links.
              </p>
              <div className="space-y-3">
                <CheckItem text="Personalized to your mom's interests" />
                <CheckItem text="Real products with direct buy links" />
                <CheckItem text="Send a WhatsApp chat export for ultra-personalized Gift DNA suggestions" />
                <CheckItem text="Works for any budget" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy note */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
            <svg className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Your privacy matters</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                We only use your messages to find gift suggestions. Conversation data is never stored, shared, or used for advertising. If you share a chat export for Gift DNA, it's analyzed once and immediately discarded.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-6">
            Mother's Day is May 11.<br />
            <span className="text-pink-500">Don't wait.</span>
          </h2>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            Text our concierge now and have the perfect gift picked out in under a minute.
          </p>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-pink-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-pink-600 transition shadow-lg shadow-pink-500/20"
          >
            <MessageCircle className="h-5 w-5" />
            Find Mom's Gift Now
            <ArrowRight className="h-5 w-5" />
          </a>
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
            <p className="text-xs text-gray-400 mt-3 sm:mt-0">
              &copy; 2026 Giftist.ai. All rights reserved. A product of North Beach Technologies LLC.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function StepCard({ number, icon, title, description, color }: {
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

function GiftCard({ name, subtitle, price, tag }: {
  name: string; subtitle: string; price: string; tag: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-pink-200 transition">
      <div className="aspect-square bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl mb-4 flex items-center justify-center">
        <Gift className="h-10 w-10 text-pink-300" />
      </div>
      <p className="text-[10px] text-pink-400 font-semibold uppercase tracking-wider mb-1">{tag}</p>
      <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{name}</h3>
      <p className="text-xs text-gray-400 mb-2">{subtitle}</p>
      <p className="text-sm font-semibold text-gray-900">{price}</p>
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

function ChatBubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
        role === 'user'
          ? 'bg-pink-500 text-white rounded-br-md'
          : 'bg-gray-100 text-gray-700 rounded-bl-md'
      }`}>
        {text}
      </div>
    </div>
  )
}
