'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Gift, ExternalLink, ShoppingCart, MessageCircle, ArrowRight, Check, Copy, Share2, X } from 'lucide-react'
import Link from 'next/link'

interface ProductData {
  slug: string
  productName: string
  targetUrl: string
  price: string | null
  priceValue: number | null
  image: string | null
  domain: string
}

function ProductPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const purchased = searchParams.get('purchased') === '1'

  const [product, setProduct] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyingLoading, setBuyingLoading] = useState(false)
  const [showShareModal, setShowShareModal] = useState(purchased)
  const [copied, setCopied] = useState(false)
  const [recipientPhone, setRecipientPhone] = useState('')

  useEffect(() => {
    if (!slug) return
    fetch(`/api/p/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setProduct(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  const giftUrl = `https://giftist.ai/p/${slug}`

  const handleBuy = async () => {
    if (!product || buyingLoading) return
    setBuyingLoading(true)
    try {
      const res = await fetch('/api/purchase/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        if (res.status === 401) {
          window.location.href = `/login?callbackUrl=${encodeURIComponent(`/p/${slug}`)}`
        }
        setBuyingLoading(false)
      }
    } catch {
      setBuyingLoading(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(giftUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareViaWhatsApp = () => {
    if (!product) return
    const phone = recipientPhone.replace(/\D/g, '')
    const text = `I got you something! 🎁\n\n${product.productName}${product.price ? ` (${product.price})` : ''}\n\nOpen your gift: ${giftUrl}`
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const shareNative = async () => {
    if (!product) return
    try {
      await navigator.share({
        title: `Gift: ${product.productName}`,
        text: `I got you something! ${product.productName}`,
        url: giftUrl,
      })
    } catch {
      copyLink()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4">
        <Gift className="h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Product not found</p>
        <Link href="/" className="text-sm text-primary hover:text-primary-hover">
          Go to Giftist
        </Link>
      </div>
    )
  }

  const fee = product.priceValue ? Math.round(product.priceValue * 0.05 * 100) / 100 : null
  const total = product.priceValue && fee ? Math.round((product.priceValue + fee) * 100) / 100 : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            Giftist
          </Link>
          <Link
            href={`/chat?q=${encodeURIComponent(`Tell me more about "${product.productName}"`)}`}
            className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Ask concierge
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Product card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Image */}
          <div className="aspect-square bg-gray-100 relative overflow-hidden">
            {product.image ? (
              <img
                src={product.image}
                alt={product.productName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Gift className="h-20 w-20 text-gray-300" />
              </div>
            )}
            {purchased && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg">
                Purchased
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-5">
            <h1 className="text-xl font-semibold text-gray-900 leading-tight">
              {product.productName}
            </h1>
            <p className="text-sm text-gray-400 mt-1">from {product.domain}</p>

            {product.price && (
              <p className="text-2xl font-bold text-gray-900 mt-3">{product.price}</p>
            )}

            <div className="mt-5 space-y-3">
              {purchased ? (
                /* After purchase: show send gift button */
                <button
                  onClick={() => setShowShareModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition"
                >
                  <Gift className="h-4 w-4" />
                  Send this gift
                </button>
              ) : (
                /* Before purchase: buy button */
                <button
                  onClick={handleBuy}
                  disabled={buyingLoading || !product.priceValue}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-hover transition disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {buyingLoading
                    ? 'Redirecting...'
                    : total
                      ? `Buy Now — $${total.toFixed(2)}`
                      : 'Buy Now'}
                </button>
              )}

              {!purchased && total && fee && (
                <div className="text-center">
                  <p className="text-xs text-gray-400">
                    {product.price} + ${fee.toFixed(2)} service fee
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">
                    Charges will appear as North Beach Technologies LLC
                  </p>
                </div>
              )}

              {/* View on retailer */}
              <a
                href={`/go-r/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition"
              >
                <ExternalLink className="h-4 w-4" />
                View on {product.domain}
              </a>
            </div>
          </div>
        </div>

        {!purchased && (
          <>
            {/* Ask concierge CTA */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">Not sure? Ask your Gift Concierge</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Get personalized advice, find similar items, or compare options.
                  </p>
                  <Link
                    href={`/chat?q=${encodeURIComponent(`I'm looking at "${product.productName}" (${product.price || 'no price'}). What do you think? Any similar alternatives?`)}`}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:text-primary-hover transition"
                  >
                    Chat with concierge
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* WhatsApp CTA */}
            <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-green-600 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">Buy via WhatsApp</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Message our concierge to buy this gift or get it for someone special.
                  </p>
                  <a
                    href={`https://wa.me/15014438478?text=${encodeURIComponent(`I want to buy "${product.productName}" ${product.price || ''}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-green-600 hover:text-green-700 transition"
                  >
                    Message on WhatsApp
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Share / Send Gift Modal */}
      {showShareModal && product && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 relative sm:mx-4">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Send this gift</h2>
              <p className="text-sm text-gray-500 mt-1">
                Share the link with the lucky recipient
              </p>
            </div>

            {/* Product summary */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mb-5">
              {product.image ? (
                <img src={product.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{product.productName}</p>
                {product.price && <p className="text-xs text-gray-500">{product.price}</p>}
              </div>
            </div>

            {/* Recipient phone (optional) */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Recipient&apos;s phone number (optional)
              </label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. (555) 123-4567"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary transition"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter their number to send directly via WhatsApp
              </p>
            </div>

            {/* Share options */}
            <div className="space-y-2.5">
              <button
                onClick={shareViaWhatsApp}
                className="w-full flex items-center justify-center gap-2 bg-green-500 text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-green-600 transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Send via WhatsApp
              </button>

              <button
                onClick={shareNative}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-900 px-5 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
              >
                <Share2 className="h-4 w-4" />
                Share link
              </button>

              <button
                onClick={copyLink}
                className="w-full flex items-center justify-center gap-2 text-gray-500 px-5 py-2.5 rounded-xl text-sm hover:text-gray-700 transition"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy gift link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProductLandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading...</div></div>}>
      <ProductPage />
    </Suspense>
  )
}
