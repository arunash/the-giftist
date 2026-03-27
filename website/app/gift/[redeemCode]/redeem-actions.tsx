'use client'

import { useState } from 'react'
import {
  ExternalLink,
  Gift,
  Loader2,
  Check,
  Heart,
  Send,
  Zap,
} from 'lucide-react'

interface RedeemActionsProps {
  redeemCode: string
  itemUrl: string | null
  itemName: string
  amount: number
  senderName: string
  isLoggedIn: boolean
  isPendingRetry?: boolean
}

export function RedeemActions({
  redeemCode,
  itemUrl,
  itemName,
  amount,
  senderName,
  isLoggedIn,
  isPendingRetry,
}: RedeemActionsProps) {
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMethod, setRedeemMethod] = useState<string | null>(null)
  const [redeemed, setRedeemed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PayPal/Venmo input
  const [paypalTab, setPaypalTab] = useState<'PAYPAL' | 'VENMO'>('VENMO')
  const [paypalEmail, setPaypalEmail] = useState('')
  const [venmoPhone, setVenmoPhone] = useState('')

  // Thank you
  const [thankYouMessage, setThankYouMessage] = useState('')
  const [sendingThankYou, setSendingThankYou] = useState(false)
  const [thankYouSent, setThankYouSent] = useState(false)

  const handleRedeem = async (method: string, extra?: Record<string, string>) => {
    setRedeeming(true)
    setRedeemMethod(method)
    setError(null)

    try {
      const res = await fetch('/api/gift-send/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemCode, method, ...extra }),
      })
      const data = await res.json()

      if (res.status === 401) {
        window.location.href = `/login?gift=${redeemCode}`
        return
      }

      if (data.success) {
        setRedeemed(true)
      } else {
        setError(data.error || 'Failed to redeem gift')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setRedeeming(false)
    }
  }

  const handlePaypalRedeem = () => {
    if (paypalTab === 'VENMO') {
      if (!venmoPhone.trim()) return
      handleRedeem('VENMO', { venmoPhone: venmoPhone.trim() })
    } else {
      if (!paypalEmail.trim()) return
      handleRedeem('PAYPAL', { paypalEmail: paypalEmail.trim() })
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

        {(redeemMethod === 'PAYPAL' || redeemMethod === 'VENMO') && (
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>${amount.toFixed(2)}</strong> is on its way to your {redeemMethod === 'VENMO' ? 'Venmo' : 'PayPal'} account. It typically arrives within minutes.
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

  if (!isLoggedIn) {
    return (
      <div className="space-y-3">
        <a
          href={`/login?gift=${redeemCode}`}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-4 rounded-2xl font-semibold text-base hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200/50"
        >
          <Gift className="h-5 w-5" />
          Sign up to claim ${amount.toFixed(2)}
        </a>
        <p className="text-xs text-gray-400 text-center">
          Create a free account to redeem your gift via Venmo or PayPal
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isPendingRetry && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Your payout couldn&apos;t be completed</p>
          <p className="text-xs text-amber-600 mt-1">Please try again with your payment details below.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Primary: PayPal / Venmo */}
      <div className="border-2 border-blue-200 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800 text-center">Get ${amount.toFixed(2)} sent to you instantly</p>
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setPaypalTab('VENMO')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              paypalTab === 'VENMO'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Venmo
          </button>
          <button
            onClick={() => setPaypalTab('PAYPAL')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              paypalTab === 'PAYPAL'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            PayPal
          </button>
        </div>

        {paypalTab === 'PAYPAL' ? (
          <input
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="Your PayPal email"
            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
          />
        ) : (
          <input
            type="text"
            value={venmoPhone}
            onChange={(e) => setVenmoPhone(e.target.value)}
            placeholder="Phone number linked to Venmo"
            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
          />
        )}

        <button
          onClick={handlePaypalRedeem}
          disabled={redeeming || (paypalTab === 'PAYPAL' ? !paypalEmail.trim() : !venmoPhone.trim())}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-4 rounded-2xl font-semibold text-base hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200/50 disabled:opacity-50"
        >
          {redeeming && (redeemMethod === 'PAYPAL' || redeemMethod === 'VENMO') ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Zap className="h-5 w-5" />
          )}
          Send ${amount.toFixed(2)} to {paypalTab === 'VENMO' ? 'Venmo' : 'PayPal'}
        </button>
      </div>

    </div>
  )
}
