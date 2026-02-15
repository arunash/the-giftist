'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Gift, Share2, Check, Users } from 'lucide-react'
import { formatPrice, getProgressPercentage, formatDate, shareOrCopy } from '@/lib/utils'

interface Contribution {
  id: string
  amount: number
  message: string | null
  isAnonymous: boolean
  createdAt: string
  contributor: { name: string | null } | null
}

interface Item {
  id: string
  name: string
  price: string | null
  priceValue: number | null
  image: string | null
  url: string
  domain: string
  category: string | null
  fundedAmount: number
  goalAmount: number | null
  isPurchased: boolean
  userId: string
  contributions: Contribution[]
}

interface Retailer {
  retailer: string
  url: string
  price: string | null
  priceValue: number | null
  isOriginal: boolean
}

export default function ItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [item, setItem] = useState<Item | null>(null)
  const [retailers, setRetailers] = useState<Retailer[]>([])
  const [loading, setLoading] = useState(true)
  const [retailersLoading, setRetailersLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return

    // Fetch item data
    fetch(`/api/items/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Item not found')
        return res.json()
      })
      .then((data) => {
        setItem(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })

    // Fetch retailers in parallel
    fetch(`/api/items/${id}/retailers`)
      .then((res) => res.json())
      .then((data) => {
        setRetailers(data.retailers || [])
        setRetailersLoading(false)
      })
      .catch(() => {
        setRetailersLoading(false)
      })
  }, [id])

  const handleShare = async () => {
    const url = `${window.location.origin}/items/${id}`
    const didShare = await shareOrCopy(url, item?.name || 'Gift item')
    if (didShare) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted">{error || 'Item not found'}</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Go back
        </button>
      </div>
    )
  }

  const goal = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goal)
  const isFullyFunded = progress >= 100 || item.isPurchased
  const remaining = Math.max(0, goal - item.fundedAmount)
  const visibleContributions = item.contributions.filter(
    (c) => (c as any).status !== 'FAILED' && (c as any).status !== 'REFUNDED'
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden bg-surface border border-border">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-surface-hover overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Gift className="h-24 w-24 text-[#333]" />
            </div>
          )}

          {isFullyFunded && (
            <div className="absolute top-4 right-4 px-4 py-1.5 rounded-lg bg-red-500 text-sm font-bold text-white uppercase">
              Funded
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-white">{item.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted">{item.domain}</span>
                {item.price && (
                  <span className="text-sm font-semibold text-white">{item.price}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-hover rounded-lg text-sm text-muted hover:text-white transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          {/* Funding progress */}
          {goal > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-white font-medium">
                  {formatPrice(item.fundedAmount)} of {formatPrice(goal)} funded
                </span>
                <span className="text-muted">{progress}%</span>
              </div>
              <div className="h-2.5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isFullyFunded
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : progress >= 50
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-red-500 to-orange-400'
                  }`}
                  style={{ width: `${Math.max(progress, 2)}%` }}
                />
              </div>
              {!isFullyFunded && remaining > 0 && (
                <p className="text-xs text-muted mt-1.5">
                  {formatPrice(remaining)} remaining
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contributors */}
      {visibleContributions.length > 0 && (
        <div className="mt-6 rounded-2xl bg-surface border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-white">
              Contributors ({visibleContributions.length})
            </h2>
          </div>
          <div className="space-y-3">
            {visibleContributions.map((c) => (
              <div key={c.id} className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-white">
                    {c.isAnonymous ? 'Anonymous' : c.contributor?.name || 'Someone'}
                  </p>
                  {c.message && (
                    <p className="text-xs text-muted mt-0.5 italic">"{c.message}"</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{formatPrice(c.amount)}</p>
                  <p className="text-xs text-muted">{formatDate(c.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retailers */}
      <div className="mt-6 rounded-2xl bg-surface border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-white">Where to buy</h2>
        </div>

        {retailersLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-surface-hover rounded-xl animate-pulse" />
            ))}
          </div>
        ) : retailers.length > 0 ? (
          <div className="space-y-2">
            {retailers.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-surface-hover rounded-xl hover:bg-border transition-colors group"
              >
                <div>
                  <p className="text-sm text-white font-medium">
                    {r.retailer}
                    {r.isOriginal && (
                      <span className="ml-2 text-xs text-muted">(original)</span>
                    )}
                  </p>
                  {r.price && (
                    <p className="text-xs text-muted mt-0.5">{r.price}</p>
                  )}
                </div>
                <span className="text-xs text-red-400 group-hover:text-red-300 transition-colors flex items-center gap-1">
                  Buy from {r.retailer}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            ))}
          </div>
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-surface-hover rounded-xl hover:bg-border transition-colors"
          >
            <p className="text-sm text-white">{item.domain}</p>
            <span className="text-xs text-red-400 flex items-center gap-1">
              Visit store
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        )}
      </div>

      {/* Contribute button — sticky at bottom */}
      {!isFullyFunded && goal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => {
                // Trigger the contribute flow — dispatch a custom event the feed can listen for
                window.dispatchEvent(
                  new CustomEvent('giftist:contribute', { detail: { itemId: item.id } })
                )
              }}
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
            >
              Contribute ({formatPrice(remaining)} remaining)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
