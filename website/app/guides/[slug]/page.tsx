import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, Gift, ExternalLink, MessageCircle } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getListicle, LISTICLES } from '@/lib/listicles'
import { createTrackedLink } from '@/lib/product-link'
import { commissionMultiplier } from '@/lib/commission-rates'
import { ListicleCard } from './listicle-card'

export const revalidate = 3600 // hourly ISR

export async function generateStaticParams() {
  return LISTICLES.map(l => ({ slug: l.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const listicle = getListicle(params.slug)
  if (!listicle) return { title: 'Not found' }
  const ogImage = `https://giftist.ai/opengraph-image`
  return {
    title: listicle.metaTitle,
    description: listicle.description,
    alternates: { canonical: `https://giftist.ai/guides/${listicle.slug}` },
    openGraph: {
      title: listicle.title,
      description: listicle.description,
      url: `https://giftist.ai/guides/${listicle.slug}`,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: listicle.title,
      description: listicle.description,
      images: [ogImage],
    },
    other: {
      'pinterest-rich-pin': 'true',
    },
  }
}

interface PickRow {
  id: string
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  url: string | null
  domain: string | null
  why: string | null
  totalScore: number
  signalCount: number
  sources: any
  occasions: string[]
  trackedSlug?: string
}

async function getPicks(slug: string): Promise<{ listicle: ReturnType<typeof getListicle>; picks: PickRow[] } | null> {
  const listicle = getListicle(slug)
  if (!listicle) return null

  const where: any = {
    reviewStatus: 'approved',
    image: { not: null },
    url: { not: null },
  }
  if (listicle.filter.interests?.length) where.interests = { hasSome: listicle.filter.interests }
  if (listicle.filter.occasions?.length) where.occasions = { hasSome: listicle.filter.occasions }
  if (listicle.filter.recipientTypes?.length) where.recipientTypes = { hasSome: listicle.filter.recipientTypes }
  if (listicle.filter.priceMin !== undefined || listicle.filter.priceMax !== undefined) {
    where.priceValue = {}
    if (listicle.filter.priceMin !== undefined) where.priceValue.gte = listicle.filter.priceMin
    if (listicle.filter.priceMax !== undefined) where.priceValue.lte = listicle.filter.priceMax
  }

  // Pull a wider pool, then sort Amazon-first since that's where commission
  // is actually wired up. Fall back to non-Amazon when needed for variety.
  const pool = await prisma.tastemakerGift.findMany({
    where,
    orderBy: { totalScore: 'desc' },
    take: (listicle.limit || 12) * 3,
    select: {
      id: true, name: true, price: true, priceValue: true, image: true,
      url: true, domain: true, why: true, totalScore: true, signalCount: true,
      sources: true, occasions: true, interests: true,
    },
  })

  // Rank by commission-weighted score: high-commission Amazon products
  // (luxury beauty 10%, furniture 8%) bubble above books (4.5%) which bubble
  // above tech (2%). Non-Amazon products are heavily penalized since we
  // earn $0 on them. Tie-break on totalScore.
  pool.sort((a, b) => {
    const am = commissionMultiplier(a) * (a.totalScore || 0)
    const bm = commissionMultiplier(b) * (b.totalScore || 0)
    return bm - am
  })

  const picked = pool.slice(0, listicle.limit || 12)

  // Create tracked links so Buy + Gift CTAs route through /go-r and /p
  const withSlugs: PickRow[] = []
  for (const p of picked) {
    let trackedSlug: string | undefined
    try {
      const trackedUrl = await createTrackedLink({
        productName: p.name,
        targetUrl: p.url!,
        price: p.price,
        priceValue: p.priceValue,
        image: p.image,
        source: 'LISTICLE',
      })
      trackedSlug = trackedUrl.split('/p/')[1]
    } catch {}
    withSlugs.push({ ...p, trackedSlug })
  }

  return { listicle, picks: withSlugs }
}

export default async function ListiclePage({ params }: { params: { slug: string } }) {
  const data = await getPicks(params.slug)
  if (!data) notFound()
  const { listicle, picks } = data
  if (!listicle) notFound()

  // SEO ItemList JSON-LD so Google can render it as a list-style result
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listicle.title,
    description: listicle.description,
    url: `https://giftist.ai/guides/${listicle.slug}`,
    numberOfItems: picks.length,
    itemListElement: picks.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        description: p.why || `Curated gift recommendation`,
        ...(p.image ? { image: p.image } : {}),
        ...(p.trackedSlug ? { url: `https://giftist.ai/p/${p.trackedSlug}` } : {}),
        ...(p.priceValue ? {
          offers: {
            '@type': 'Offer',
            price: p.priceValue,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            url: p.trackedSlug ? `https://giftist.ai/p/${p.trackedSlug}` : undefined,
          },
        } : {}),
      },
    })),
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">The Giftist</span>
          </Link>
          <Link
            href="/magic"
            className="text-xs font-semibold text-pink-500 hover:text-pink-600 transition"
          >
            Magic gift finder →
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-pink-500" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-pink-500 font-bold">
              Curated by Giftist
            </p>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl text-gray-900 leading-[1.1] tracking-tight">
            {listicle.title}
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mt-5 max-w-xl mx-auto">
            {listicle.intro}
          </p>
          <p className="text-xs text-gray-400 mt-4">
            {picks.length} hand-picked products · backed by Wirecutter, NY Mag, Reddit, and real reviews
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {picks.map((p, i) => (
            <ListicleCard key={p.id} pick={p} index={i + 1} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100 rounded-3xl p-8 sm:p-10">
          <div className="inline-flex items-center gap-1.5 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-pink-500" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-pink-500 font-bold">Need more options?</p>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-gray-900 leading-tight mb-3">
            Try our 30-second magic gift finder
          </h2>
          <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
            Tell us about them. We&apos;ll pick three perfect things — personalized to who you&apos;re shopping for.
          </p>
          <Link
            href="/magic"
            className="inline-flex items-center gap-2 py-3.5 px-7 bg-gray-900 text-white rounded-full font-semibold text-sm hover:bg-gray-800 transition shadow-lg"
          >
            <Gift className="h-4 w-4" />
            Find my perfect gift
          </Link>
        </div>

        {/* More listicles */}
        <div className="mt-14 pt-10 border-t border-gray-100">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-4">More gift guides</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LISTICLES.filter(l => l.slug !== listicle.slug).slice(0, 6).map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/guides/${l.slug}`}
                  className="block py-2 px-3 -mx-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition"
                >
                  {l.title} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  )
}
