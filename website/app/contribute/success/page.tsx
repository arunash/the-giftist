'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'

interface ContributionData {
  id: string
  amount: number
  status: string
  message: string | null
  isAnonymous: boolean
  createdAt: string
  item: { name: string; image: string | null; price: string | null } | null
  event: { name: string; type: string } | null
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const returnUrl = searchParams.get('returnUrl') || '/'

  const [data, setData] = useState<ContributionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    Promise.all([
      fetch(`/api/contribute/success?id=${id}`).then((r) => r.json()),
      fetch('/api/auth/session').then((r) => r.json()),
    ])
      .then(([contribution, session]) => {
        setData(contribution)
        setIsLoggedIn(!!session?.user)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    )
  }

  const giftName = data?.item?.name || data?.event?.name || 'a gift'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo-light.png" alt="Giftist" width={34} height={34} className="rounded-lg" />
              <span className="text-xl font-bold text-primary">The Giftist</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        {/* Success Card */}
        <div className="bg-surface rounded-2xl border border-border p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-9 w-9 text-emerald-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Thank you for your contribution!
          </h1>

          {data ? (
            <>
              <p className="text-muted mb-6">
                You contributed <span className="font-semibold text-gray-900">{formatPrice(data.amount)}</span> toward{' '}
                <span className="font-semibold text-gray-900">{giftName}</span>.
              </p>

              {/* Receipt */}
              <div className="bg-surface-hover rounded-xl p-5 text-left mb-6">
                {data.item?.image && (
                  <img
                    src={data.item.image}
                    alt={data.item.name}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Gift</span>
                    <span className="text-gray-900 font-medium">{giftName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Amount</span>
                    <span className="text-gray-900 font-medium">{formatPrice(data.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Status</span>
                    <span className="text-emerald-600 font-medium">
                      {data.status === 'COMPLETED' ? 'Confirmed' : 'Processing'}
                    </span>
                  </div>
                  {data.message && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-muted">Your message:</span>
                      <p className="text-gray-900 italic mt-1">"{data.message}"</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted mb-6">
              Your contribution is being processed. You'll be notified when the gift is purchased.
            </p>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href={returnUrl}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to wishlist
            </Link>

            {!isLoggedIn && (
              <Link
                href="/login"
                className="block w-full py-3 bg-surface-hover text-gray-900 rounded-xl font-medium hover:bg-border transition text-center"
              >
                Create your own Giftist
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ContributeSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
