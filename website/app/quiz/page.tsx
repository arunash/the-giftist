import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { QuizWizard } from './quiz-wizard'

export const metadata: Metadata = {
  title: 'Find the Perfect Gift in 30 Seconds | Giftist',
  description: 'Answer 4 quick questions and get 3 hand-picked gift ideas backed by Wirecutter, NY Mag Strategist, and real expert reviews.',
  alternates: { canonical: 'https://giftist.ai/quiz' },
}

export default function QuizPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-violet-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-light.png" alt="Giftist" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">The Giftist</span>
          </Link>
          <Link
            href="/shop"
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
          >
            Skip · Browse all gifts
          </Link>
        </div>
      </nav>

      <QuizWizard />
    </div>
  )
}
