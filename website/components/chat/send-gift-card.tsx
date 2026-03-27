'use client'

import { useState } from 'react'
import { Gift, Loader2, ArrowRight } from 'lucide-react'

interface SendGiftCardProps {
  data: {
    recipientName: string
    recipientPhone?: string
    recipientRef?: string
    itemName: string
    itemPrice: number
    itemUrl?: string
    itemImage?: string
    senderMessage?: string
  }
  autoExecute?: boolean
}

export function SendGiftCard({ data, autoExecute }: SendGiftCardProps) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = data.itemPrice
  const platformFee = Math.round(amount * (amount >= 100 ? 0.10 : 0.15) * 100) / 100
  const total = Math.round((amount + platformFee) * 100) / 100

  const giftPayload = {
    recipientPhone: data.recipientPhone,
    recipientName: data.recipientName,
    itemName: data.itemName,
    itemPrice: data.itemPrice,
    itemUrl: data.itemUrl,
    itemImage: data.itemImage,
    senderMessage: data.senderMessage,
  }

  const handleSend = async () => {
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/gift-send/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(giftPayload),
      })
      const result = await res.json()
      if (result.checkoutUrl) {
        setSent(true)
        window.location.href = result.checkoutUrl
      } else {
        setError(result.error || 'Failed to start checkout')
        setSending(false)
      }
    } catch {
      setError('Something went wrong')
      setSending(false)
    }
  }

  const handlePayPalSend = async () => {
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/gift-send/paypal-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(giftPayload),
      })
      const result = await res.json()
      if (result.approvalUrl) {
        setSent(true)
        window.location.href = result.approvalUrl
      } else {
        setError(result.error || 'Failed to start PayPal checkout')
        setSending(false)
      }
    } catch {
      setError('Something went wrong')
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl my-2 text-xs text-green-600">
        <Gift className="h-3.5 w-3.5" />
        Redirecting to checkout...
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-4 my-2 max-w-xs">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-4 w-4 text-pink-500" />
        <span className="text-xs font-semibold text-pink-600 uppercase tracking-wider">Send a Gift</span>
      </div>

      <p className="text-sm font-semibold text-gray-900 mb-1">{data.itemName}</p>
      <p className="text-xs text-gray-500 mb-3">To {data.recipientName}</p>

      {data.senderMessage && (
        <p className="text-xs text-gray-500 italic mb-3">"{data.senderMessage}"</p>
      )}

      <div className="space-y-1 mb-3 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Item</span>
          <span className="text-gray-900">${amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Service fee</span>
          <span className="text-gray-500">${platformFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-pink-200">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-semibold text-gray-900">${total.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      <div className="space-y-2">
        <button
          onClick={handlePayPalSend}
          disabled={sending || !data.recipientPhone}
          className="w-full flex items-center justify-center gap-2 bg-[#0070ba] text-white px-4 py-2.5 rounded-xl font-semibold text-xs hover:bg-[#005ea6] transition disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span>Pay with PayPal / Venmo — ${total.toFixed(2)}</span>
          )}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !data.recipientPhone}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-xs hover:bg-gray-200 transition disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span>Pay with Card — ${total.toFixed(2)}</span>
          )}
        </button>
      </div>

      {!data.recipientPhone && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Phone number needed — add {data.recipientName} to your circle first
        </p>
      )}
    </div>
  )
}
