import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { MessageCircle, Sparkles, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Gift Ideas — Curated by AI | Giftist',
  description: 'Browse curated gift recommendations from our AI concierge. Every product is hand-picked and verified. Find the perfect gift for anyone.',
}

const WHATSAPP_URL = 'https://wa.me/15014438478'

// Price tier labels
function priceTier(price: number): string {
  if (price <= 25) return 'Under $25'
  if (price <= 50) return '$25 – $50'
  if (price <= 100) return '$50 – $100'
  if (price <= 200) return '$100 – $200'
  return '$200+'
}

export default async function GiftsPage() {
  // Pull verified products from the cache
  const products = await prisma.productUrlCache.findMany({
    where: {
      priceValue: { gt: 0 },
      url: { not: null },
    },
    orderBy: { verifiedAt: 'desc' },
    take: 100,
  })

  // Group by price tier
  const tiers = new Map<string, typeof products>()
  const tierOrder = ['Under $25', '$25 – $50', '$50 – $100', '$100 – $200', '$200+']
  for (const tier of tierOrder) tiers.set(tier, [])

  for (const p of products) {
    const tier = priceTier(p.priceValue || 0)
    tiers.get(tier)?.push(p)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">Giftist</span>
          </Link>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("I need help finding a gift")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#20bd5a] transition"
          >
            <MessageCircle className="h-4 w-4" />
            Chat with Concierge
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-violet-100 border border-violet-200 rounded-full mb-6">
          <Sparkles className="h-3 w-3 text-violet-600" />
          <span className="text-xs font-semibold text-violet-600">{products.length} curated products</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
          Gift ideas for everyone
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Every product is hand-picked by our AI concierge and verified with real prices and links. Want something more personal? Text us on WhatsApp.
        </p>
      </div>

      {/* Product grid by price tier */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        {tierOrder.map((tier) => {
          const tierProducts = tiers.get(tier) || []
          if (tierProducts.length === 0) return null
          return (
            <div key={tier} className="mb-12">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                {tier}
                <span className="text-xs font-normal text-gray-400">({tierProducts.length})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {tierProducts.slice(0, 12).map((p) => (
                  <a
                    key={p.id}
                    href={`${WHATSAPP_URL}?text=${encodeURIComponent(`I'm interested in ${p.productName}. Can you find me the best price?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all group"
                  >
                    {p.image ? (
                      <div className="aspect-square bg-gray-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.image} alt={p.productName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center">
                        <span className="text-3xl">🎁</span>
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        {p.domain?.replace('www.', '')}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5 line-clamp-2">
                        {p.productName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-gray-900">{p.price}</span>
                        <span className="text-[11px] text-[#25D366] font-semibold flex items-center gap-1 group-hover:text-[#20bd5a]">
                          <MessageCircle className="h-3 w-3" />
                          Get it
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
              {tierProducts.length > 12 && (
                <p className="text-sm text-gray-400 mt-3">
                  + {tierProducts.length - 12} more in this range —{' '}
                  <a
                    href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Show me more gift ideas ${tier.toLowerCase()}`)}`}
                    className="text-violet-600 hover:underline"
                  >
                    ask your concierge
                  </a>
                </p>
              )}
            </div>
          )
        })}

        {/* Bottom CTA */}
        <div className="text-center mt-8 p-8 bg-white rounded-2xl border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Want something more personal?
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            Tell our AI concierge who you&apos;re shopping for — interests, age, budget — and get 3 curated picks in seconds.
          </p>
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent("I need help finding a gift")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#25D366] text-white px-8 py-4 rounded-2xl font-semibold text-base hover:bg-[#20bd5a] transition"
          >
            <MessageCircle className="h-5 w-5" />
            Chat with your concierge
          </a>
        </div>
      </div>
    </div>
  )
}
