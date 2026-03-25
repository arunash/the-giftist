'use client'

import { useState, useEffect, Suspense } from 'react'
import { Gift, Loader2, Check, DollarSign, Wallet, Heart, Send, ArrowRight, BanknoteIcon, Phone, Lock } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

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
  phoneLast4: string | null
}

function GiftRedeemInner() {
  const params = useParams()
  const redeemCode = params.redeemCode as string
  const { data: session, status: authStatus } = useSession()

  const [gift, setGift] = useState<GiftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Phone verification
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Redemption
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)
  const [redeemedMethod, setRedeemedMethod] = useState<string | null>(null)
  const [showRedeemOptions, setShowRedeemOptions] = useState(false)

  // Thank you
  const [thankYouMessage, setThankYouMessage] = useState('')
  const [sendingThankYou, setSendingThankYou] = useState(false)
  const [thankYouSent, setThankYouSent] = useState(false)

  useEffect(() => {
    fetch(`/api/gift-send/redeem?code=${redeemCode}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setGift(data)
          if (data.redeemedAt) {
            setRedeemed(true)
            setPhoneVerified(true) // already redeemed, no need to verify
          }
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load gift')
        setLoading(false)
      })
  }, [redeemCode])

  const handleVerifyPhone = async () => {
    if (!phoneInput.trim()) return
    setVerifying(true)
    setPhoneError('')

    try {
      const res = await fetch('/api/gift-send/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemCode, phone: phoneInput.trim() }),
      })
      const data = await res.json()
      if (data.verified) {
        setPhoneVerified(true)
      } else {
        setPhoneError(data.error || 'Phone number does not match. Please try again.')
      }
    } catch {
      setPhoneError('Verification failed. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleRedeemClick = () => {
    if (authStatus !== 'authenticated') {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/gift/${redeemCode}`)}`
      return
    }
    setShowRedeemOptions(true)
  }

  const handleRedeem = async (method: 'CASH_OUT' | 'WALLET') => {
    if (!gift) return
    if (authStatus !== 'authenticated') {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/gift/${redeemCode}`)}`
      return
    }

    setRedeeming(true)
    try {
      const res = await fetch('/api/gift-send/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemCode, method }),
      })
      const data = await res.json()

      if (res.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent(`/gift/${redeemCode}`)}`
        return
      }

      if (data.success) {
        setRedeemed(true)
        setRedeemedMethod(method)
        setShowRedeemOptions(false)
      } else {
        setError(data.error || 'Failed to redeem gift')
      }
    } catch {
      setError('Failed to redeem gift')
    } finally {
      setRedeeming(false)
    }
  }

  const handleSendThankYou = async () => {
    if (!thankYouMessage.trim()) return
    setSendingThankYou(true)
    try {
      const res = await fetch('/api/gift-send/thank-you', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemCode, message: thankYouMessage.trim() }),
      })
      const data = await res.json()
      if (data.success) setThankYouSent(true)
    } catch {} finally {
      setSendingThankYou(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your gift...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !gift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-2">Gift not found</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!gift) return null

  const isRedeemable = !gift.redeemedAt && !redeemed && (gift.status === 'PAID' || gift.status === 'NOTIFIED')

  // Phone verification gate — show before revealing gift details
  if (!phoneVerified && !redeemed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-6 py-8 text-white text-center overflow-hidden">
              <div className="absolute top-2 left-4 w-3 h-3 bg-yellow-300 rounded-full opacity-60" />
              <div className="absolute top-6 right-8 w-2 h-2 bg-green-300 rounded-full opacity-60" />
              <div className="absolute bottom-4 left-12 w-2 h-2 bg-blue-300 rounded-full opacity-60" />
              <div className="absolute bottom-3 right-6 w-3 h-3 bg-yellow-200 rounded-full opacity-50" />
              <p className="text-4xl mb-3">🎁</p>
              <p className="text-xl font-bold">You received a gift!</p>
              <p className="text-sm opacity-80 mt-1">from {gift.senderName}</p>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Lock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Verify your phone number</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enter your phone number to unlock this gift
                    {gift.phoneLast4 && <span> (ending in {gift.phoneLast4})</span>}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={e => { setPhoneInput(e.target.value); setPhoneError('') }}
                    placeholder="Enter your phone number"
                    className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary transition"
                    onKeyDown={e => e.key === 'Enter' && handleVerifyPhone()}
                    autoFocus
                  />
                </div>

                {phoneError && (
                  <p className="text-xs text-red-500 px-1">{phoneError}</p>
                )}

                <button
                  onClick={handleVerifyPhone}
                  disabled={verifying || !phoneInput.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-5 py-3.5 rounded-xl font-semibold text-sm hover:from-pink-600 hover:to-purple-600 transition disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                  Unlock Gift
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-3 text-center">
              <p className="text-xs text-gray-400">
                Powered by <a href="https://giftist.ai" className="text-primary hover:underline">The Giftist</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

          {/* Banner */}
          <div className="relative bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-6 py-8 text-white text-center overflow-hidden">
            <div className="absolute top-2 left-4 w-3 h-3 bg-yellow-300 rounded-full opacity-60" />
            <div className="absolute top-6 right-8 w-2 h-2 bg-green-300 rounded-full opacity-60" />
            <div className="absolute bottom-4 left-12 w-2 h-2 bg-blue-300 rounded-full opacity-60" />
            <div className="absolute top-3 right-16 w-4 h-4 bg-pink-300 rounded-full opacity-40" />
            <div className="absolute bottom-3 right-6 w-3 h-3 bg-yellow-200 rounded-full opacity-50" />
            <div className="absolute bottom-6 left-6 w-2.5 h-2.5 bg-emerald-300 rounded-full opacity-50" />

            {redeemed ? (
              <>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6" />
                </div>
                <p className="text-xl font-bold">Gift Redeemed Successfully!</p>
                <p className="text-sm opacity-80 mt-1">from {gift.senderName}</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">🎁</p>
                <p className="text-xl font-bold">You received a gift!</p>
                <p className="text-sm opacity-80 mt-1">from {gift.senderName}</p>
              </>
            )}
          </div>

          {/* Item details */}
          <div className="px-6 py-6">
            {gift.itemImage && (
              <div className="w-full h-48 rounded-2xl overflow-hidden mb-4 bg-gray-50">
                <img src={gift.itemImage} alt={gift.itemName} className="w-full h-full object-cover" />
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-900 mb-1">{gift.itemName}</h2>
            <p className="text-2xl font-bold text-primary mb-4">${gift.amount.toFixed(2)}</p>

            {gift.senderMessage && (
              <div className="bg-purple-50 border-l-4 border-purple-300 rounded-r-xl px-4 py-3 mb-5">
                <p className="text-sm text-gray-700 italic leading-relaxed">&ldquo;{gift.senderMessage}&rdquo;</p>
                <p className="text-xs text-gray-400 mt-1.5">— {gift.senderName}</p>
              </div>
            )}

            {/* Redeem button */}
            {isRedeemable && !showRedeemOptions && (
              <button
                onClick={handleRedeemClick}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-5 py-4 rounded-2xl font-semibold text-base hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg shadow-pink-200/50"
              >
                <Gift className="h-5 w-5" />
                Redeem Gift
              </button>
            )}

            {/* Redeem options */}
            {isRedeemable && showRedeemOptions && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-600 text-center mb-1">How would you like to redeem?</p>

                <button
                  onClick={() => handleRedeem('CASH_OUT')}
                  disabled={redeeming}
                  className="w-full flex items-center gap-3 bg-primary text-white px-5 py-4 rounded-xl font-semibold text-sm hover:bg-primary-hover transition disabled:opacity-50"
                >
                  {redeeming ? <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" /> : <DollarSign className="h-5 w-5 flex-shrink-0" />}
                  <div className="text-left flex-1">
                    <p>Redeem Amount</p>
                    <p className="text-xs font-normal opacity-80 mt-0.5">Withdraw ${gift.amount.toFixed(2)} to your bank account</p>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-60" />
                </button>

                <button
                  onClick={() => handleRedeem('WALLET')}
                  disabled={redeeming}
                  className="w-full flex items-center gap-3 bg-gray-100 text-gray-900 px-5 py-4 rounded-xl font-semibold text-sm hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {redeeming ? <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" /> : <Wallet className="h-5 w-5 flex-shrink-0" />}
                  <div className="text-left flex-1">
                    <p>Add to Giftist Wallet</p>
                    <p className="text-xs font-normal text-gray-500 mt-0.5">Use ${gift.amount.toFixed(2)} for gifts on Giftist</p>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                </button>

                <button onClick={() => setShowRedeemOptions(false)} className="w-full text-sm text-gray-400 hover:text-gray-600 transition py-1">
                  Cancel
                </button>
              </div>
            )}

            {/* Just redeemed — success + next steps */}
            {redeemed && !thankYouSent && (
              <div className="mt-1">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-700">Gift redeemed successfully!</p>
                </div>

                {redeemedMethod === 'CASH_OUT' && (
                  <Link href="/wallet" className="w-full flex items-center justify-center gap-2 bg-primary text-white px-5 py-3.5 rounded-xl font-semibold text-sm hover:bg-primary-hover transition mb-4">
                    <BanknoteIcon className="h-4 w-4" />
                    Set up withdrawal to bank
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}

                {redeemedMethod === 'WALLET' && (
                  <Link href="/wallet" className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-900 px-5 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition mb-4">
                    <Wallet className="h-4 w-4" />
                    View your Giftist Wallet
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}

                <div className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="h-4 w-4 text-pink-500" />
                    <p className="text-sm font-semibold text-gray-800">Send a thank you</p>
                  </div>
                  <textarea
                    value={thankYouMessage}
                    onChange={e => setThankYouMessage(e.target.value)}
                    placeholder={`Say thanks to ${gift.senderName}...`}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition"
                    rows={3}
                  />
                  <button
                    onClick={handleSendThankYou}
                    disabled={sendingThankYou || !thankYouMessage.trim()}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:from-pink-600 hover:to-purple-600 transition disabled:opacity-50"
                  >
                    {sendingThankYou ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </div>
              </div>
            )}

            {thankYouSent && (
              <div className="mt-1">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-700">Gift redeemed successfully!</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-4 text-center">
                  <Heart className="h-6 w-6 text-pink-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-purple-800">Thank you sent to {gift.senderName}!</p>
                </div>
              </div>
            )}

            {/* Already redeemed (loaded in that state) */}
            {!isRedeemable && gift.redeemedAt && !redeemed && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <Check className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-500">This gift has already been redeemed</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 px-6 py-3 text-center">
            <p className="text-xs text-gray-400">
              Powered by <a href="https://giftist.ai" className="text-primary hover:underline">The Giftist</a>
            </p>
          </div>
        </div>
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
