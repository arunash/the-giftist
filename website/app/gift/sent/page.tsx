import { prisma } from '@/lib/db'
import { Gift, Check, ArrowLeft, Clock } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default async function GiftSentPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  const sessionId = searchParams.id

  const gift = sessionId
    ? await prisma.giftSend.findUnique({
        where: { stripeSessionId: sessionId },
      })
    : null

  // Payment processing / webhook hasn't fired yet
  if (!gift) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Clock className="h-10 w-10 text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Payment processing...</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your payment is being confirmed. This usually takes just a few seconds.
            Check back shortly.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to chat
          </Link>
        </div>
      </div>
    )
  }

  const recipientDisplay = gift.recipientName || 'your friend'

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          {/* Purple gradient header with confetti dots */}
          <div className="relative bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 px-6 py-8 text-white text-center overflow-hidden">
            {/* Confetti dots */}
            <div className="absolute top-2 left-4 w-3 h-3 bg-yellow-300 rounded-full opacity-60" />
            <div className="absolute top-6 right-8 w-2 h-2 bg-green-300 rounded-full opacity-60" />
            <div className="absolute bottom-4 left-12 w-2 h-2 bg-blue-300 rounded-full opacity-60" />
            <div className="absolute top-3 right-16 w-4 h-4 bg-pink-300 rounded-full opacity-40" />
            <div className="absolute bottom-3 right-6 w-3 h-3 bg-yellow-200 rounded-full opacity-50" />
            <div className="absolute bottom-6 left-6 w-2.5 h-2.5 bg-emerald-300 rounded-full opacity-50" />

            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-4 opacity-90">
              <Image
                src="/logo-light.png"
                alt="Giftist"
                width={24}
                height={24}
                className="rounded-md"
              />
              <span className="text-sm font-semibold tracking-wide">The Giftist</span>
            </div>

            <div className="w-14 h-14 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="h-7 w-7" />
            </div>
            <p className="text-xl font-bold">Gift sent!</p>
          </div>

          {/* Gift details */}
          <div className="px-6 py-6">
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Recipient</span>
                <span className="text-sm font-medium text-gray-900">{recipientDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Item</span>
                <span className="text-sm font-medium text-gray-900">{gift.itemName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Amount</span>
                <span className="text-sm font-medium text-gray-900">${gift.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-violet-50 border-l-4 border-violet-300 rounded-r-xl px-4 py-3 mb-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                We&rsquo;ll notify {recipientDisplay} shortly with a link to claim their gift.
              </p>
            </div>

            <Link
              href="/chat"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-4 rounded-2xl font-semibold text-base hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200/50"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to chat
            </Link>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-3 text-center">
            <p className="text-xs text-gray-400">
              Powered by{' '}
              <a href="https://giftist.ai" className="text-primary hover:underline">
                The Giftist
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
