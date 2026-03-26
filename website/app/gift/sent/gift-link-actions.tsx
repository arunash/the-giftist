'use client'

import { useState } from 'react'
import { Copy, Check, Share2, Link2 } from 'lucide-react'

interface GiftLinkActionsProps {
  claimUrl: string
  recipientName: string
  itemName: string
  amount: number
}

export function GiftLinkActions({ claimUrl, recipientName, itemName, amount }: GiftLinkActionsProps) {
  const [copied, setCopied] = useState(false)

  const shareText = `I sent you a gift — ${itemName} ($${amount.toFixed(2)})! Claim it here: ${claimUrl}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(claimUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Gift from The Giftist`,
        text: shareText,
        url: claimUrl,
      }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Link2 className="h-4 w-4 text-violet-600" />
        <p className="text-sm font-semibold text-gray-800">Share the gift link</p>
      </div>

      {/* Claim URL display */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3">
        <p className="text-xs text-gray-600 truncate flex-1 font-mono">{claimUrl}</p>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Share + Copy buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-3 rounded-xl font-semibold text-sm hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200/50"
        >
          <Share2 className="h-4 w-4" />
          Share link
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 bg-white border-2 border-violet-200 text-violet-700 px-4 py-3 rounded-xl font-semibold text-sm hover:bg-violet-50 transition"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p className="text-[11px] text-gray-400 text-center mt-2.5 leading-relaxed">
        Send this link to {recipientName} via WhatsApp, iMessage, email, or any channel you prefer.
        We&rsquo;ll also send them a notification.
      </p>
    </div>
  )
}
