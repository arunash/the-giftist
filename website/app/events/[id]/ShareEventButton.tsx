'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { shareOrCopy } from '@/lib/utils'

export default function ShareEventButton({ shareUrl, eventName }: { shareUrl: string; eventName: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareText = `Check out my ${eventName} wishlist on The Giftist!`
    const didShare = await shareOrCopy(shareUrl, eventName, shareText)
    if (didShare) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 text-muted hover:text-gray-900 transition"
    >
      {copied ? (
        <>
          <Check className="h-5 w-5 text-green-600" />
          <span className="text-green-600 text-sm">Shared!</span>
        </>
      ) : (
        <>
          <Share2 className="h-5 w-5" />
          <span className="text-sm">Share Wishlist</span>
        </>
      )}
    </button>
  )
}
