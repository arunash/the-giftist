'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Gift, Share2, Check } from 'lucide-react'
import { shareOrCopy, giftistShareText } from '@/lib/utils'

export default function ShareHeader({ shareId, ownerName }: { shareId: string; ownerName: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `https://giftist.ai/u/${shareId}`
    const didShare = await shareOrCopy(url, `${ownerName}'s Wishlist`, giftistShareText(ownerName))
    if (didShare) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="bg-surface border-b border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Gift className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">The Giftist</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/login?callbackUrl=/u/${shareId}`}
              className="text-sm text-muted hover:text-gray-900 transition"
            >
              Sign in
            </Link>
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
                  <span className="text-sm">Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
