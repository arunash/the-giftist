'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { shareOrCopy, giftistShareText } from '@/lib/utils'

export default function ShareItemButton({ itemId, ownerName }: { itemId: string; ownerName: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `https://giftist.ai/items/${itemId}`
    const didShare = await shareOrCopy(url, 'A gift idea on The Giftist', giftistShareText(ownerName))
    if (didShare) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex-1 flex items-center justify-center gap-1 text-sm text-muted hover:text-gray-900 py-2 rounded-lg bg-surface-hover hover:bg-surface-raised transition"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-green-600">Shared!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Share
        </>
      )}
    </button>
  )
}
