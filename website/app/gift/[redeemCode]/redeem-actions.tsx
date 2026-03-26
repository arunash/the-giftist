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
  const [error, setError] = useState<string | null>(null)

  // Thank you
  const [thankYouMessage, setThankYouMessage] = useState('')
  const [sendingThankYou, setSendingThankYou] = useState(false)
  const [thankYouSent, setThankYouSent] = useState(false)

  const handleRedeem = async (method: 'WALLET' | 'ITEM') => {
    setRedeeming(true)
    setRedeemMethod(method)
    setError(null)

    try {
      const res = await fetch('/api/gift-send/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemCode, method: 'WALLET' }),
      })
      const data = await res.json()

      if (res.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent(`/gift/${redeemCode}`)}`
        return
      }

      if (data.success) {
        setRedeemed(true)
        // If they chose to buy the item, open the URL
        if (method === 'ITEM' && itemUrl) {
          window.open(itemUrl, '_blank')
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
        <div className="bg-violet-50/70 border border-violet-100 rounded-xl px-4 py-3">
          <p className="text-xs text-violet-700 leading-relaxed">
            <strong>${amount.toFixed(2)}</strong> has been added to your Giftist Wallet.
            To make your purchase, withdraw funds to Venmo, PayPal, or your bank account
            from your <a href="/settings" className="underline font-medium">wallet settings</a>.
          </p>
        </div>
        {redeemMethod === 'ITEM' && itemUrl && (
          <a
            href={itemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-violet-200 text-violet-700 px-4 py-3 rounded-xl font-semibold text-sm hover:bg-violet-50 transition"
          >
            <ExternalLink className="h-4 w-4" />
            View item to purchase
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
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* How it works */}
      <div className="bg-violet-50/70 border border-violet-100 rounded-2xl px-4 py-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Wallet className="h-4 w-4 text-violet-600" />
          <p className="text-sm font-semibold text-violet-800">How it works</p>
        </div>
        <ol className="text-xs text-violet-700 space-y-1.5 list-decimal list-inside leading-relaxed">
          <li><strong>Claim your gift</strong> &mdash; ${amount.toFixed(2)} is added to your Giftist Wallet</li>
          <li><strong>Withdraw funds</strong> &mdash; transfer to Venmo, PayPal, or bank (5-7 days)</li>
          <li><strong>Buy what you love</strong> &mdash; use the funds to purchase this item or anything else</li>
        </ol>
      </div>

      <button
        onClick={() => handleRedeem('ITEM')}
        disabled={redeeming}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-4 rounded-2xl font-semibold text-base hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200/50 disabled:opacity-50"
      >
        {redeeming && redeemMethod === 'ITEM' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Gift className="h-5 w-5" />
        )}
        Claim ${amount.toFixed(2)} to my wallet
      </button>

      {itemUrl && !redeemed && (
        <p className="text-xs text-gray-400 text-center -mt-1">
          We&apos;ll also open the item link so you can purchase it after withdrawal
        </p>
      )}

      <p className="text-[11px] text-gray-400 text-center leading-relaxed">
        Funds are deposited to your Giftist Wallet. Withdraw via Venmo, PayPal, or bank transfer to make your purchase.
      </p>
    </div>
  )
}
