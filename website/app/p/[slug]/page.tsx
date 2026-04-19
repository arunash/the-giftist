'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Gift, ExternalLink, ShoppingCart, MessageCircle, ArrowRight, Check, Copy, Share2, X, Loader2, Heart, Sparkles, ShieldCheck, Star, RefreshCw, Headphones, DollarSign, Lightbulb } from 'lucide-react'
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

interface GiftData {
  id: string
  redeemCode: string
  recipientName: string | null
  itemName: string
  amount: number
}

function ProductPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const purchased = searchParams.get('purchased') === '1'
  const giftIdParam = searchParams.get('giftId')
  const fromParam = searchParams.get('from')

  const [product, setProduct] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyingLoading, setBuyingLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [saved, setSaved] = useState(false)

  // Detect channel: WhatsApp or web
  const [channel, setChannel] = useState<'web' | 'whatsapp'>('web')
  useEffect(() => {
    if (fromParam === 'wa') {
      setChannel('whatsapp')
      return
    }
    // Detect WhatsApp in-app browser via user agent
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('whatsapp')) {
      setChannel('whatsapp')
    }
  }, [fromParam])

  // Check auth status
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(s => setIsLoggedIn(!!s?.user))
      .catch(() => setIsLoggedIn(false))
  }, [])

  // Pre-checkout: recipient info
  const [showRecipientModal, setShowRecipientModal] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [senderMessage, setSenderMessage] = useState('')

  // Post-checkout: gift sharing
  const [giftData, setGiftData] = useState<GiftData | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadingGift, setLoadingGift] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/p/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setProduct(data)
        setLoading(false)

        // Auto-open retailer page in new tab (affiliate click)
        // Only on first visit, not after purchase redirect
        if (data?.targetUrl && !purchased) {
          window.open(`/go-r/${slug}`, '_blank')
          // Bring focus back to Giftist tab
          window.focus()
        }
      })
      .catch(() => setLoading(false))
  }, [slug])

  // After purchase, fetch gift data
  useEffect(() => {
    if (!purchased || !giftIdParam) return
    setLoadingGift(true)
    fetch(`/api/gift-send/${giftIdParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setGiftData(data)
          setShowShareModal(true)
        }
        setLoadingGift(false)
      })
      .catch(() => setLoadingGift(false))
  }, [purchased, giftIdParam])

  const giftUrl = giftData ? `https://giftist.ai/gift/${giftData.redeemCode}` : ''

  // Check if target URL is a real product page (not a search/category page)
  const hasRealProductUrl = product?.targetUrl && !product.targetUrl.includes('/s?k=') && !product.targetUrl.includes('google.com/search') && !product.targetUrl.includes('/search?')

  const requireAuth = () => {
    if (!isLoggedIn && channel !== 'whatsapp') {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/p/${slug}`)}`
      return true
    }
    if (!isLoggedIn && channel === 'whatsapp') {
      // WhatsApp users: only block on buy, not on browse
      return false
    }
    return false
  }

  const requireAuthForPurchase = () => {
    if (!isLoggedIn) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/p/${slug}?from=wa`)}`
      return true
    }
    return false
  }

  const handleBuyClick = () => {
    if (requireAuthForPurchase()) return
    setShowRecipientModal(true)
  }

  const handleCheckout = async () => {
    if (!product || buyingLoading || !recipientName.trim() || !recipientPhone.trim()) return
    setBuyingLoading(true)
    try {
      const res = await fetch('/api/purchase/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: product.slug,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim() || undefined,
          senderMessage: senderMessage.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else if (res.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent(`/p/${slug}`)}`
      } else {
        setBuyingLoading(false)
      }
    } catch {
      setBuyingLoading(false)
    }
  }

  const handlePayPalCheckout = async () => {
    if (!product || buyingLoading || !recipientName.trim() || !recipientPhone.trim()) return
    setBuyingLoading(true)
    try {
      const res = await fetch('/api/gift-send/paypal-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: recipientPhone.trim(),
          recipientName: recipientName.trim(),
          itemName: product.productName,
          itemPrice: product.priceValue,
          itemUrl: product.targetUrl,
          itemImage: product.image,
          senderMessage: senderMessage.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.approvalUrl) {
        window.location.href = data.approvalUrl
      } else if (res.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent(`/p/${slug}`)}`
      } else {
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
    if (!giftData) return
    const phone = recipientPhone.replace(/\D/g, '')
    const text = `I got you something!\n\nOpen your gift: ${giftUrl}`
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const shareNative = async () => {
    if (!giftData) return
    try {
      await navigator.share({
        title: `You received a gift!`,
        text: `I got you something!`,
        url: giftUrl,
      })
    } catch {
      copyLink()
    }
  }

  const handleSaveForLater = () => {
    if (requireAuth()) return
    setSaved(true)
  }

  const askConcierge = (prompt: string) => {
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/15014438478?text=${encodeURIComponent(prompt)}`, '_blank')
      return
    }
    if (requireAuth()) return
    window.location.href = `/chat?q=${encodeURIComponent(prompt)}`
  }

  // Redirect to login if not authenticated — BUT skip for WhatsApp users (they can browse without login)
  useEffect(() => {
    if (isLoggedIn === false && channel !== 'whatsapp') {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/p/${slug}${fromParam ? `?from=${fromParam}` : ''}`)}`
    }
  }, [isLoggedIn, slug, fromParam, channel])

  if (loading || isLoggedIn === null || (isLoggedIn === false && channel !== 'whatsapp')) {
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

  const fee = product.priceValue ? Math.round(product.priceValue * (product.priceValue >= 100 ? 0.10 : 0.15) * 100) / 100 : null
  const shippingFee = 5.99
  const total = product.priceValue && fee ? Math.round((product.priceValue + fee + shippingFee) * 100) / 100 : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            Giftist
          </Link>
          <button
            onClick={() => askConcierge(`Tell me more about "${product.productName}"`)}
            className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1"
          >
            {channel === 'whatsapp' ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            ) : (
              <MessageCircle className="h-3.5 w-3.5" />
            )}
            Ask concierge
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Product card with image */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {product.image && (
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              <img
                src={product.image}
                alt={product.productName}
                className="w-full h-full object-cover"
              />
              {/* Picked by Giftist badge */}
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Picked by Giftist
              </div>
              {purchased && (
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg">
                  Purchased
                </div>
              )}
            </div>
          )}

          <div className="p-5">
            <h1 className="text-xl font-semibold text-gray-900 leading-tight">
              {product.productName}
            </h1>
            {product.price && (
              <p className="text-2xl font-bold text-gray-900 mt-2">{product.price}</p>
            )}
          </div>
        </div>

        {/* Why this works */}
        {!purchased && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Why this works</h3>
            </div>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="text-gray-400 mt-0.5">&#8226;</span>
                <span>Popular, well-reviewed choice that almost anyone would appreciate</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="text-gray-400 mt-0.5">&#8226;</span>
                <span>Feels like a thoughtful upgrade, not a random gift</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="text-gray-400 mt-0.5">&#8226;</span>
                <span>From a trusted brand with reliable quality</span>
              </li>
            </ul>
          </div>
        )}

        {/* Verification badges */}
        {!purchased && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <ShieldCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Verified price from {product.domain}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>In stock and ready to ship</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Star className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span>Highly rated by verified buyers</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          {/* Save for later */}
          {!purchased && (
            <button
              onClick={handleSaveForLater}
              className={`w-full flex items-center justify-center gap-2 py-3 border rounded-xl font-medium text-sm transition ${
                saved
                  ? 'border-pink-200 bg-pink-50 text-pink-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Heart className={`h-4 w-4 ${saved ? 'fill-pink-500 text-pink-500' : ''}`} />
              {saved ? 'Saved!' : 'Save for later'}
            </button>
          )}

          {/* Buy as Gift */}
          {purchased && giftData ? (
            <button
              onClick={() => setShowShareModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition"
            >
              <Gift className="h-4 w-4" />
              Send to {giftData.recipientName || 'recipient'}
            </button>
          ) : purchased && loadingGift ? (
            <button disabled className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-200 text-gray-500 rounded-xl font-semibold text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading gift...
            </button>
          ) : !purchased ? (
            <>
              <button
                onClick={handleBuyClick}
                disabled={buyingLoading || !product.priceValue}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-hover transition disabled:opacity-50"
              >
                <Gift className="h-4 w-4" />
                {total ? `Buy as Gift — $${total.toFixed(2)}` : 'Buy as Gift'}
              </button>
              {total && fee && (
                <p className="text-xs text-gray-400 text-center">
                  {product.price} + ${fee.toFixed(2)} service + ${shippingFee.toFixed(2)} shipping
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Ask Giftist chat prompts */}
        {!purchased && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-gray-900 text-sm">Ask Giftist</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: '"Is this a good gift for my dad?"', prompt: `Is "${product.productName}" a good gift for my dad?` },
                { label: '"Show me cheaper options"', prompt: `Show me cheaper alternatives to "${product.productName}" (${product.price || ''}) — something under $100` },
                { label: '"Compare with alternatives"', prompt: `Compare "${product.productName}" with similar alternatives. Which one is the best gift?` },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => askConcierge(item.prompt)}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-700 transition flex items-center gap-2"
                >
                  {channel === 'whatsapp' ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-green-500 flex-shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  ) : null}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Not sure yet? Alternative suggestions */}
        {!purchased && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Not sure yet? Try these:</h3>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => askConcierge(`Show me similar premium gifts like "${product.productName}" in the same price range`)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-700 transition"
              >
                <Headphones className="h-4 w-4 text-gray-400 flex-shrink-0" />
                Similar premium gifts
              </button>
              <button
                onClick={() => askConcierge(`Show me gift alternatives under $100 similar to "${product.productName}"`)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-700 transition"
              >
                <DollarSign className="h-4 w-4 text-gray-400 flex-shrink-0" />
                Alternatives under $100
              </button>
              <button
                onClick={() => askConcierge(`What are the safest, most universally loved gifts similar to "${product.productName}"?`)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm text-gray-700 transition"
              >
                <Lightbulb className="h-4 w-4 text-gray-400 flex-shrink-0" />
                Safer crowd-favorite gifts
              </button>
            </div>
          </div>
        )}

        {/* Concierge help CTA */}
        {!purchased && (
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {channel === 'whatsapp' ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-green-600">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                ) : (
                  <MessageCircle className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm">Your Giftist concierge can help</h3>
                <ul className="mt-2 space-y-1.5">
                  <li className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="text-primary">&#8226;</span> Personalize this for your recipient
                  </li>
                  <li className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="text-primary">&#8226;</span> Find better options instantly
                  </li>
                  <li className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="text-primary">&#8226;</span> Help you decide faster
                  </li>
                </ul>
                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={() => askConcierge(`I'm looking at "${product.productName}" (${product.price || 'no price'}). Help me decide — is this the right gift?`)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition"
                  >
                    {channel === 'whatsapp' ? 'Chat on WhatsApp' : 'Chat now'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {channel === 'web' && (
                    <a
                      href={`https://wa.me/15014438478?text=${encodeURIComponent(`I'm looking at "${product.productName}" (${product.price || 'no price'}). Help me decide — is this the right gift?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 transition"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View on retailer — only show if we have a real product page URL */}
        {hasRealProductUrl && (
          <div className="text-center py-2">
            <button
              onClick={() => {
                if (requireAuth()) return
                window.open(`/go-r/${slug}`, '_blank')
              }}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on {product.domain}
            </button>
          </div>
        )}
      </div>

      {/* Recipient info modal (pre-checkout) */}
      {showRecipientModal && product && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 relative sm:mx-4">
            <button
              onClick={() => { setShowRecipientModal(false); setBuyingLoading(false) }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-900">Who is this gift for?</h2>
              <p className="text-sm text-gray-500 mt-1">
                We&apos;ll create a gift link for them to redeem.
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

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Recipient&apos;s name *
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Their phone number *
                </label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="e.g. (555) 123-4567"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary transition"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Required to verify the recipient when they open the gift
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Personal message (optional)
                </label>
                <textarea
                  value={senderMessage}
                  onChange={(e) => setSenderMessage(e.target.value)}
                  placeholder="Happy birthday! Hope you love it"
                  rows={2}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary transition resize-none"
                />
              </div>

              <button
                onClick={handleCheckout}
                disabled={buyingLoading || !recipientName.trim() || !recipientPhone.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-hover transition disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                {buyingLoading ? 'Redirecting to payment...' : total ? `Pay $${total.toFixed(2)}` : 'Continue to payment'}
              </button>
              <button
                onClick={handlePayPalCheckout}
                disabled={buyingLoading || !recipientName.trim() || !recipientPhone.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition disabled:opacity-50"
              >
                {buyingLoading ? 'Redirecting...' : 'Pay with PayPal / Venmo'}
              </button>

              {total && fee && (
                <div className="text-center">
                  <p className="text-xs text-gray-400">
                    {product.price} + ${fee.toFixed(2)} service fee + ${shippingFee.toFixed(2)} shipping
                  </p>
                  <p className="text-[10px] text-gray-300">
                    Charges will appear as North Beach Technologies LLC
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share / Send Gift Modal (post-checkout) */}
      {showShareModal && giftData && (
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
              <h2 className="text-lg font-bold text-gray-900">Gift purchased!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Send the gift link to {giftData.recipientName || 'the recipient'}
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
                <p className="text-sm font-medium text-gray-900 truncate">{giftData.itemName}</p>
                <p className="text-xs text-green-600 font-medium">${giftData.amount.toFixed(2)}</p>
              </div>
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

            <p className="text-[10px] text-gray-300 text-center mt-4">
              Recipient will open giftist.ai/gift/... to view and redeem
            </p>
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
