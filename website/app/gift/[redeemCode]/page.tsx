'use client'

import { useState, useEffect } from 'react'
import { Gift, ExternalLink, Wallet, Loader2, Check, MessageCircle } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface GiftData {
  id: string
  senderName: string
  recipientName: string | null
  itemName: string
  itemPrice: number
  itemUrl: string | null
  itemImage: string | null
  senderMessage: string | null
  amount: number
  status: string
  redeemCode: string
  redeemedAt: string | null
}

function GiftRedeemInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const redeemCode = params.redeemCode as string
  const direct = searchParams.get('direct') === '1'

  const [gift, setGift] = useState<GiftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    fetch(`/api/gift-send/redeem?code=${redeemCode}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setGift(data)
          // If gift is redeemable and not direct mode, redirect to WhatsApp
          if (!direct && !data.redeemedAt && (data.status === 'PAID' || data.status === 'NOTIFIED')) {
            redirectToWhatsApp(data)
          }
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load gift')
        setLoading(false)
      })
  }, [redeemCode, direct])

  const redirectToWhatsApp = (giftData: GiftData) => {
    setRedirecting(true)
    const giftUrl = `${window.location.origin}/gift/${giftData.redeemCode}?direct=1`
    const waText = `I received a gift! Redeem code: ${giftData.redeemCode}`
    // WhatsApp Business number
    const waNumber = '15014438478'
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`

    // Try to open WhatsApp, fall back to showing the page directly
    const timeout = setTimeout(() => {
      // If we're still here after 2s, WhatsApp didn't open — show page
      setRedirecting(false)
    }, 2000)

    window.location.href = waUrl

    // Listen for visibility change (if app opens, page goes hidden)
    const handleVisibility = () => {
      if (document.hidden) {
        clearTimeout(timeout)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility, { once: true })
  }

  const handleRedeem = async (method: 'ITEM_CLICK' | 'WALLET') => {
    if (!gift) return
    setRedeeming(true)

    try {
      if (method === 'ITEM_CLICK') {
        // Mark as redeemed and redirect to retailer
        await fetch('/api/gift-send/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redeemCode, method: 'ITEM_CLICK' }),
        })
        setRedeemed(true)
        if (gift.itemUrl) {
          window.open(gift.itemUrl, '_blank')
        }
      } else {
        const res = await fetch('/api/gift-send/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redeemCode, method: 'WALLET' }),
        })
        const data = await res.json()
        if (data.error === 'Login required to redeem to wallet') {
          // Redirect to login then back here
          window.location.href = `/login?callbackUrl=${encodeURIComponent(`/gift/${redeemCode}?direct=1`)}`
          return
        }
        if (data.success) {
          setRedeemed(true)
        }
      }
    } catch {
      setError('Failed to redeem gift')
    } finally {
      setRedeeming(false)
    }
  }

  if (loading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            {redirecting ? 'Opening WhatsApp...' : 'Loading your gift...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50 px-4">
        <div className="text-center max-w-sm">
          <Gift className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900 mb-2">Gift not available</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!gift) return null

  const isRedeemable = !gift.redeemedAt && (gift.status === 'PAID' || gift.status === 'NOTIFIED')

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Gift card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-5 text-white text-center">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-90" />
            <p className="text-sm opacity-80">You received a gift from</p>
            <p className="text-xl font-bold">{gift.senderName || 'A friend'}</p>
          </div>

          {/* Item details */}
          <div className="px-6 py-5">
            {gift.itemImage && (
              <div className="w-full h-48 rounded-xl overflow-hidden mb-4 bg-gray-50">
                <img
                  src={gift.itemImage}
                  alt={gift.itemName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-900 mb-1">{gift.itemName}</h2>
            <p className="text-2xl font-bold text-primary mb-3">${gift.amount.toFixed(2)}</p>

            {gift.senderMessage && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-gray-600 italic">"{gift.senderMessage}"</p>
              </div>
            )}

            {redeemed && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                <Check className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-700">Gift redeemed!</p>
              </div>
            )}

            {isRedeemable && !redeemed && (
              <div className="space-y-3">
                {gift.itemUrl && (
                  <button
                    onClick={() => handleRedeem('ITEM_CLICK')}
                    disabled={redeeming}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-white px-5 py-3.5 rounded-xl font-semibold text-sm hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Buy this item
                  </button>
                )}
                <button
                  onClick={() => handleRedeem('WALLET')}
                  disabled={redeeming}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-900 px-5 py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  Use ${gift.amount.toFixed(2)} for something else
                </button>
              </div>
            )}

            {!isRedeemable && !redeemed && gift.redeemedAt && (
              <p className="text-sm text-gray-500 text-center">This gift has already been redeemed.</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-3 text-center">
            <p className="text-xs text-gray-400">
              Powered by <a href="https://giftist.ai" className="text-primary hover:underline">The Giftist</a>
            </p>
          </div>
        </div>

        {/* WhatsApp CTA for non-users */}
        {!redeemed && (
          <div className="mt-6 text-center">
            <a
              href={`https://wa.me/15014438478?text=${encodeURIComponent('Hi! I want to create my own gift wishlist')}`}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 transition"
            >
              <MessageCircle className="h-4 w-4" />
              Create your own wishlist on Giftist
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GiftRedeemPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    }>
      <GiftRedeemInner />
    </Suspense>
  )
}
