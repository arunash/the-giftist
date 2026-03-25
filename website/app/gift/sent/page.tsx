'use client'

import { useState, useEffect } from 'react'
import { Gift, Copy, Check, MessageCircle, Loader2, Share2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

interface GiftData {
  id: string
  recipientName: string | null
  recipientPhone: string
  itemName: string
  amount: number
  platformFee: number
  totalCharged: number
  senderMessage: string | null
  status: string
  redeemCode: string
}

function GiftSentInner() {
  const searchParams = useSearchParams()
  const giftId = searchParams.get('id')

  const [gift, setGift] = useState<GiftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!giftId) {
      setLoading(false)
      return
    }
    fetch(`/api/gift-send/${giftId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setGift(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [giftId])

  const giftUrl = gift ? `${window.location.origin}/gift/${gift.redeemCode}` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(giftUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareViaWhatsApp = () => {
    if (!gift) return
    const recipientPhone = gift.recipientPhone
    const text = `I sent you a gift on Giftist! 🎁\n\n${giftUrl}`
    window.open(`https://wa.me/${recipientPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const shareNative = async () => {
    if (!gift) return
    try {
      await navigator.share({
        title: `Gift from The Giftist`,
        text: `I sent you "${gift.itemName}" on Giftist!`,
        url: giftUrl,
      })
    } catch {
      copyLink()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    )
  }

  if (!gift) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <Gift className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Gift not found</p>
          <Link href="/chat" className="text-primary text-sm hover:underline mt-2 inline-block">
            Back to chat
          </Link>
        </div>
      </div>
    )
  }

  const recipientDisplay = gift.recipientName || 'your friend'

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {/* Success animation */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Gift className="h-10 w-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gift sent!</h1>
        <p className="text-gray-600 mb-8">
          {recipientDisplay} will get a message with your gift shortly.
        </p>

        {/* Gift summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 text-left">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Item</span>
            <span className="text-sm font-medium text-gray-900">{gift.itemName}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Amount</span>
            <span className="text-sm font-medium text-gray-900">${gift.amount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Service fee</span>
            <span className="text-sm text-gray-500">${gift.platformFee.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Total charged</span>
            <span className="text-sm font-semibold text-gray-900">${gift.totalCharged.toFixed(2)}</span>
          </div>
        </div>

        {/* Share options */}
        <div className="space-y-3 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Share the gift link</p>

          <button
            onClick={shareViaWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-green-500 text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-green-600 transition"
          >
            <MessageCircle className="h-4 w-4" />
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
            className="w-full flex items-center justify-center gap-2 text-gray-500 px-5 py-2 rounded-xl text-sm hover:text-gray-700 transition"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <Link
          href="/chat"
          className="text-sm text-primary hover:underline"
        >
          Back to chat
        </Link>
      </div>
    </div>
  )
}

export default function GiftSentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    }>
      <GiftSentInner />
    </Suspense>
  )
}
