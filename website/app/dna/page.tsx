import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Dna, MessageCircle, ArrowRight, Shield } from 'lucide-react'

const WA_LINK = 'https://wa.me/15014438478?text=I%20want%20to%20create%20a%20Gift%20DNA'

export default function GiftDnaLanding() {
  redirect(WA_LINK)

  // Fallback content (never reached, but kept for SEO/crawlers)
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-orange-50">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-3xl mx-auto px-6 pt-4">
          <div className="flex justify-between items-center h-14 px-6 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl shadow-black/5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
              <span className="text-lg font-bold text-gray-900 tracking-tight">The Giftist</span>
            </Link>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium bg-primary text-white px-5 py-2 rounded-xl hover:bg-primary-hover transition"
            >
              Try it free
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full mb-8">
            <Dna className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-xs font-semibold text-violet-500 tracking-wide uppercase">Gift DNA</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-5">
            Stop guessing.<br />
            <span className="text-violet-500">Know what they want.</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-lg mx-auto leading-relaxed mb-10">
            Share a WhatsApp chat and we'll build a Gift DNA profile — their interests, favorite brands, wish statements, and personalized gift ideas. Takes 30 seconds.
          </p>

          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 bg-green-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-green-700 transition shadow-lg shadow-green-600/20"
          >
            <MessageCircle className="h-5 w-5" />
            Create your first Gift DNA
            <ArrowRight className="h-5 w-5" />
          </a>

          <p className="text-xs text-gray-400 mt-4">Free — no account needed. Just message our WhatsApp bot.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <Step number="1" title="Export a chat" description="Open any WhatsApp conversation, tap the menu, and export the chat (without media)." />
            <Step number="2" title="Send it to Giftist" description="Forward the exported file to our WhatsApp bot. Pick the friend you want to analyze." />
            <Step number="3" title="Get their Gift DNA" description="In seconds, see their interests, brands, wishes — plus 3 personalized gift ideas." />
          </div>
        </div>
      </section>

      {/* Mock DNA card */}
      <section className="py-16 px-6">
        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                <Dna className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Sarah's Gift DNA</h3>
                <p className="text-[11px] text-gray-400">Built from 847 messages</p>
              </div>
            </div>

            <div className="space-y-3">
              <DnaRow label="Interests" value="cooking, hiking, true crime podcasts" />
              <DnaRow label="Brands" value="Le Creuset, Patagonia, Glossier" />
              <DnaRow label="Style" value="minimalist, earthy tones" />
              <DnaRow label="Wish list" value={`"I need a good chef's knife"`} />
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[11px] text-violet-500 font-semibold uppercase tracking-wider mb-2">Top suggestions</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  Miyabi Birchwood Chef's Knife — $179
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  Patagonia Better Sweater — $139
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  Le Creuset Salt Crock — $40
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy callout */}
      <section className="py-12 px-6">
        <div className="max-w-xl mx-auto">
          <div className="flex items-start gap-4 bg-white border border-gray-200 rounded-2xl px-6 py-5">
            <Shield className="h-6 w-6 text-violet-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900 text-sm mb-1">Your privacy matters</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                We only extract gifting preferences — all conversation data is permanently discarded after building the Gift DNA. We never store or read your messages.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-4">
            Ready to find the perfect gift?
          </h2>
          <p className="text-gray-500 mb-8">
            It takes 30 seconds. Export a chat, send it to Giftist, get their Gift DNA.
          </p>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 bg-green-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-green-700 transition shadow-lg shadow-green-600/20"
          >
            <MessageCircle className="h-5 w-5" />
            Create Gift DNA on WhatsApp
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Giftist" width={22} height={22} className="rounded-md" />
            <span className="text-sm font-semibold text-gray-900">The Giftist</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-900 transition">Terms</Link>
            <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-900 transition">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
        <span className="text-sm font-bold text-violet-500">{number}</span>
      </div>
      <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}

function DnaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  )
}
