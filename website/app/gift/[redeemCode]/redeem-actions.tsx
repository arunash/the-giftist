'use client'

import { useState } from 'react'
import {
  ExternalLink,
  Gift,
  Wallet,
  Loader2,
  Check,
  Heart,
  Send,
  Zap,
  CreditCard,
} from 'lucide-react'

interface RedeemActionsProps {
  redeemCode: string
  itemUrl: string | null
  itemName: string
  amount: number
  senderName: string
}

export function RedeemActions({
  redeemCode,
  itemUrl,
  itemName,
  amount,
  senderName,
}: RedeemActionsProps) {
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMethod, setRedeemMethod] = useState<string | null>(null)
  const [redeemed, setRedeemed] = useState(false)
  const [claimLink, setClaimLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Thank you
  const [thankYouMessage, setThankYouMessage] = useState('')
  const [sendingThankYou, setSendingThankYou] = useState(false)
  const [thankYouSent, setThankYouSent] = useState(false)

  const handleRedeem = async (method: 'TREMENDOUS' | 'WALLET') => {
    setRedeeming(true)
    setRedeemMethod(method)
    setError(null)

    try {
      const res = await fetch('/api/gift-send/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemCode, method }),
      })
      const data = await res.json()

      if (res.status === 401) {
        window.location.href = `/login?gift=${redeemCode}`
        return
      }

      if (data.success) {
        setRedeemed(true)
        if (data.claimLink) {
          setClaimLink(data.claimLink)
          // Auto-redirect to Tremendous claim page
          window.open(data.claimLink, '_blank')
        }
      } else {
        setError(data.error || 'Failed to redeem gift')
      }
    } catch {
      setError('Something went wrong. Please try again.')
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
    } catch {
      // silent fail
    } finally {
      setSendingThankYou(false)
    }
  }

  // Redeemed state
  if (redeemed) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-700">
            Gift redeemed successfully!
          </p>
        </div>

        {redeemMethod === 'TREMENDOUS' && claimLink && (
          <div className="bg-violet-50/70 border border-violet-100 rounded-xl px-4 py-3">
            <p className="text-xs text-violet-700 leading-relaxed mb-2">
              Choose how you&apos;d like to receive your <strong>${amount.toFixed(2)}</strong> — Amazon gift card, Visa prepaid card, Venmo, PayPal, and more.
            </p>
            <a
              href={claimLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-3 rounded-xl font-semibold text-sm hover:from-violet-600 hover:to-purple-700 transition"
            >
              <CreditCard className="h-4 w-4" />
              Choose your reward
            </a>
          </div>
        )}

        {redeemMethod === 'WALLET' && (
          <div className="bg-violet-50/70 border border-violet-100 rounded-xl px-4 py-3">
            <p className="text-xs text-violet-700 leading-relaxed">
              <strong>${amount.toFixed(2)}</strong> has been added to your Giftist Wallet.
              Withdraw to Venmo, PayPal, or your bank account
              from your <a href="/settings" className="underline font-medium">wallet settings</a>.
            </p>
          </div>
        )}

        {itemUrl && (
          <a
            href={itemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-violet-200 text-violet-700 px-4 py-3 rounded-xl font-semibold text-sm hover:bg-violet-50 transition"
          >
            <ExternalLink className="h-4 w-4" />
            View the suggested item
          </a>
        )}

        {!thankYouSent ? (
          <div className="border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="h-4 w-4 text-pink-500" />
              <p className="text-sm font-semibold text-gray-800">
                Send a thank you
              </p>
            </div>
            <textarea
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              placeholder={`Say thanks to ${senderName}...`}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition"
              rows={3}
            />
            <button
              onClick={handleSendThankYou}
              disabled={sendingThankYou || !thankYouMessage.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:from-violet-600 hover:to-purple-700 transition disabled:opacity-50"
            >
              {sendingThankYou ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </button>
          </div>
        ) : (
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-4 text-center">
            <Heart className="h-6 w-6 text-pink-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-purple-800">
              Thank you sent to {senderName}!
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Primary: Instant redemption via Tremendous */}
      <button
        onClick={() => handleRedeem('TREMENDOUS')}
        disabled={redeeming}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-4 rounded-2xl font-semibold text-base hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200/50 disabled:opacity-50"
      >
        {redeeming && redeemMethod === 'TREMENDOUS' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Zap className="h-5 w-5" />
        )}
        Redeem ${amount.toFixed(2)} instantly
      </button>
      <p className="text-xs text-gray-400 text-center -mt-1">
        Pick an Amazon gift card, Visa prepaid card, Venmo, PayPal, or 800+ options
      </p>

      {/* Secondary: Wallet */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        onClick={() => handleRedeem('WALLET')}
        disabled={redeeming}
        className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-600 px-5 py-3 rounded-2xl font-medium text-sm hover:bg-gray-50 transition-all disabled:opacity-50"
      >
        {redeeming && redeemMethod === 'WALLET' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        Add to Giftist Wallet instead
      </button>
    </div>
  )
}
