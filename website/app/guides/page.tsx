import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, ArrowRight } from 'lucide-react'
import { LISTICLES } from '@/lib/listicles'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Gift Guides — Curated Picks for Every Occasion | Giftist',
  description: 'Hand-picked gift guides for Mother\'s Day, books, self-care, and more. Each list is vetted by Wirecutter, NY Mag, and real expert reviews.',
  alternates: { canonical: 'https://giftist.ai/guides' },
  openGraph: {
    title: 'Gift Guides — Giftist',
    description: 'Curated gift guides for every occasion.',
    url: 'https://giftist.ai/guides',
    type: 'website',
  },
}

export default function GiftsIndex() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">The Giftist</span>
          </Link>
          <Link href="/magic" className="text-xs font-semibold text-pink-500 hover:text-pink-600 transition">
            Magic gift finder →
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-pink-500" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-pink-500 font-bold">
              Curated guides
            </p>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 leading-[1.1] tracking-tight mb-3">
            Gift Guides
          </h1>
          <p className="text-base text-gray-600 max-w-xl mx-auto">
            Hand-picked, vetted by experts. Every product is something we&apos;d send our own family.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LISTICLES.map((l) => (
            <Link
              key={l.slug}
              href={`/guides/${l.slug}`}
              className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-300 hover:shadow-md transition-all"
            >
              <h2 className="font-serif text-lg text-gray-900 leading-tight mb-2">
                {l.title}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                {l.description}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-pink-500 group-hover:text-pink-600 transition">
                Read the guide
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </article>
    </div>
  )
}
