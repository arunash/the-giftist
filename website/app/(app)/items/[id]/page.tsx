'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Gift, Share2, Check, Users, Heart, ShoppingBag, Pencil, Trash2, X, Sparkles, Tag } from 'lucide-react'
import { formatPrice, getProgressPercentage, formatDate, shareOrCopy } from '@/lib/utils'
import Link from 'next/link'

interface Contribution {
  id: string
  amount: number
  message: string | null
  isAnonymous: boolean
  createdAt: string
  thankYouMessage: string | null
  thankYouSentAt: string | null
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
  const [markingPurchased, setMarkingPurchased] = useState(false)
  const [thankYouId, setThankYouId] = useState<string | null>(null)
  const [thankYouMsg, setThankYouMsg] = useState('')
  const [sendingThankYou, setSendingThankYou] = useState(false)
  const [isEditingItem, setIsEditingItem] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingItem, setDeletingItem] = useState(false)

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

  // Price intelligence: find best retailer
  const priceIntelligence = useMemo(() => {
    if (!item || retailers.length === 0) return null

    const nonOriginalWithPrice = retailers.filter(
      (r) => !r.isOriginal && r.priceValue != null && r.priceValue > 0
    )
    if (nonOriginalWithPrice.length === 0) return null

    const best = nonOriginalWithPrice.reduce((min, r) =>
      (r.priceValue! < min.priceValue!) ? r : min
    )

    const originalPrice = item.priceValue || 0
    if (originalPrice > 0 && best.priceValue! < originalPrice) {
      const savings = originalPrice - best.priceValue!
      return { retailer: best, savings, bestPrice: best.priceValue! }
    }

    return null
  }, [item, retailers])

  // Find cheapest retailer index for badge
  const cheapestRetailerIndex = useMemo(() => {
    if (retailers.length <= 1) return -1
    const withPrice = retailers
      .map((r, i) => ({ ...r, idx: i }))
      .filter((r) => r.priceValue != null && r.priceValue > 0)
    if (withPrice.length <= 1) return -1
    const cheapest = withPrice.reduce((min, r) => (r.priceValue! < min.priceValue!) ? r : min)
    return cheapest.idx
  }, [retailers])

  const handleShare = async () => {
    const url = `${window.location.origin}/items/${id}`
    const didShare = await shareOrCopy(url, item?.name || 'Gift item')
    if (didShare) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleMarkPurchased = async () => {
    if (!item || markingPurchased) return
    setMarkingPurchased(true)
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPurchased: true }),
      })
      if (res.ok) {
        setItem((prev) => prev ? { ...prev, isPurchased: true } : prev)
      }
    } catch (err) {
      console.error('Failed to mark as purchased:', err)
    } finally {
      setMarkingPurchased(false)
    }
  }

  const handleSendThankYou = async (contributionId: string) => {
    if (!thankYouMsg.trim() || sendingThankYou) return
    setSendingThankYou(true)
    try {
      const res = await fetch('/api/thank-you', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributionId, message: thankYouMsg }),
      })
      if (res.ok) {
        setItem((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            contributions: prev.contributions.map((c) =>
              c.id === contributionId
                ? { ...c, thankYouMessage: thankYouMsg, thankYouSentAt: new Date().toISOString() }
                : c
            ),
          }
        })
        setThankYouId(null)
        setThankYouMsg('')
      }
    } catch (err) {
      console.error('Failed to send thank-you:', err)
    } finally {
      setSendingThankYou(false)
    }
  }

  const startEditing = () => {
    if (!item) return
    setEditName(item.name)
    setEditPrice(item.price || '')
    setIsEditingItem(true)
  }

  const cancelEditing = () => {
    setIsEditingItem(false)
    setEditName('')
    setEditPrice('')
  }

  const handleSaveEdit = async () => {
    if (!item || savingEdit) return
    setSavingEdit(true)
    try {
      const patchData: any = {}
      if (editName.trim() && editName.trim() !== item.name) {
        patchData.name = editName.trim()
      }
      if (editPrice !== (item.price || '')) {
        patchData.price = editPrice || null
        const match = editPrice.replace(/,/g, '').match(/[\d.]+/)
        patchData.priceValue = match ? parseFloat(match[0]) : null
      }
      if (Object.keys(patchData).length === 0) {
        cancelEditing()
        return
      }
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      })
      if (res.ok) {
        const updated = await res.json()
        setItem((prev) =>
          prev
            ? {
                ...prev,
                name: updated.name ?? prev.name,
                price: updated.price ?? prev.price,
                priceValue: updated.priceValue ?? prev.priceValue,
              }
            : prev
        )
        setIsEditingItem(false)
      } else {
        alert('Failed to save changes')
      }
    } catch (err) {
      console.error('Failed to save edit:', err)
      alert('Failed to save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!item || deletingItem) return
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return

    setDeletingItem(true)
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/feed')
      } else {
        alert('Failed to delete item')
      }
    } catch (err) {
      console.error('Failed to delete item:', err)
      alert('Failed to delete item')
    } finally {
      setDeletingItem(false)
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
  const hasFunding = item.fundedAmount > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-gray-900 mb-6 transition-colors"
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
              {isEditingItem ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-gray-900 text-lg font-semibold outline-none focus:border-primary"
                    placeholder="Item name"
                  />
                  <input
                    type="text"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-gray-900 text-sm outline-none focus:border-primary"
                    placeholder="Price (e.g. $49.99)"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-hover transition disabled:opacity-50"
                    >
                      {savingEdit ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1.5 text-sm text-muted hover:text-gray-900 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-semibold text-gray-900">{item.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted">{item.domain}</span>
                    {item.price && (
                      <span className="text-sm font-semibold text-gray-900">{item.price}</span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isEditingItem && (
                <>
                  <button
                    onClick={startEditing}
                    className="p-2 rounded-lg text-muted hover:text-gray-900 hover:bg-surface-hover transition-colors"
                    title="Edit item"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleDeleteItem}
                    disabled={deletingItem}
                    className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface-hover rounded-lg text-sm text-muted hover:text-gray-900 transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>

          {/* Funding progress */}
          {goal > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-900 font-medium">
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

          {/* Mark as Purchased button */}
          {hasFunding && !item.isPurchased && (
            <button
              onClick={handleMarkPurchased}
              disabled={markingPurchased}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 transition disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              {markingPurchased ? 'Marking...' : 'Mark as Purchased'}
            </button>
          )}
        </div>
      </div>

      {/* Price Intelligence Card */}
      {priceIntelligence && (
        <div className="mt-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Tag className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-800 mb-1">Better price found!</h3>
              <p className="text-sm text-emerald-700">
                Best price on <span className="font-semibold">{priceIntelligence.retailer.retailer}</span> at{' '}
                <span className="font-semibold">{formatPrice(priceIntelligence.bestPrice)}</span>
                {' '}&mdash; Save {formatPrice(priceIntelligence.savings)} vs original
              </p>
              <a
                href={priceIntelligence.retailer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition"
              >
                View deal
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Contributors */}
      {visibleContributions.length > 0 && (
        <div className="mt-6 rounded-2xl bg-surface border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-gray-900">
              Contributors ({visibleContributions.length})
            </h2>
          </div>
          <div className="space-y-3">
            {visibleContributions.map((c) => (
              <div key={c.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-900">
                      {c.isAnonymous ? 'Anonymous' : c.contributor?.name || 'Someone'}
                    </p>
                    {/* Gift Note Card */}
                    {c.message && (
                      <div className="mt-1.5 bg-pink-500/5 border border-pink-500/15 rounded-lg px-3 py-2 flex items-start gap-2">
                        <Heart className="h-3.5 w-3.5 text-pink-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-pink-800 italic">&ldquo;{c.message}&rdquo;</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex items-start gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatPrice(c.amount)}</p>
                      <p className="text-xs text-muted">{formatDate(c.createdAt)}</p>
                    </div>
                    {!c.thankYouSentAt && (
                      <button
                        onClick={() => {
                          setThankYouId(thankYouId === c.id ? null : c.id)
                          setThankYouMsg('')
                        }}
                        className="text-xs flex items-center gap-1 px-2 py-1 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="Send thank you"
                      >
                        <Heart className="h-3 w-3" />
                        Thank
                      </button>
                    )}
                    {c.thankYouSentAt && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1 px-2 py-1">
                        <Check className="h-3 w-3" />
                        Thanked
                      </span>
                    )}
                  </div>
                </div>
                {/* Thank-you input */}
                {thankYouId === c.id && (
                  <div className="mt-2 ml-0 flex gap-2">
                    <input
                      type="text"
                      value={thankYouMsg}
                      onChange={(e) => setThankYouMsg(e.target.value)}
                      placeholder="Write a thank-you message..."
                      className="flex-1 px-3 py-2 text-sm bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted outline-none focus:border-primary"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendThankYou(c.id)
                      }}
                    />
                    <button
                      onClick={() => handleSendThankYou(c.id)}
                      disabled={!thankYouMsg.trim() || sendingThankYou}
                      className="px-3 py-2 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-hover transition disabled:opacity-50"
                    >
                      {sendingThankYou ? '...' : 'Send'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retailers */}
      <div className="mt-6 rounded-2xl bg-surface border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-gray-900">Where to buy</h2>
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
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm text-gray-900 font-medium">
                      {r.retailer}
                      {r.isOriginal && (
                        <span className="ml-2 text-xs text-muted">(original)</span>
                      )}
                    </p>
                    {r.price && (
                      <p className="text-xs text-muted mt-0.5">{r.price}</p>
                    )}
                  </div>
                  {i === cheapestRetailerIndex && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Best Price
                    </span>
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
            <p className="text-sm text-gray-900">{item.domain}</p>
            <span className="text-xs text-red-400 flex items-center gap-1">
              Visit store
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        )}
      </div>

      {/* Complementary Suggestions */}
      <div className="mt-6 bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Goes well with this</h3>
            <p className="text-sm text-muted mb-2">
              Your Gift Concierge can suggest complementary items.
            </p>
            <Link
              href={`/chat?q=${encodeURIComponent(`What goes well with "${item.name}"? Suggest 2-3 complementary items.`)}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition"
            >
              <Sparkles className="h-4 w-4" />
              Get suggestions
            </Link>
          </div>
        </div>
      </div>

      {/* Contribute button — sticky at bottom */}
      {!isFullyFunded && goal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => {
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
