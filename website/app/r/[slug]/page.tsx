'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

/**
 * Intermediate redirect page for product links from WhatsApp.
 *
 * Flow: user taps giftist.ai/r/SLUG in WhatsApp
 *   → this page opens
 *   → immediately opens retailer (go-r/SLUG) in new tab (affiliate click)
 *   → redirects current tab to giftist.ai/p/SLUG (product page)
 *   → user ends up on Giftist page, retailer is in background tab
 *
 * Because the current tab navigates to /p/SLUG AFTER opening the retailer,
 * the Giftist page is always the focused tab.
 */
export default function RedirectPage() {
  const params = useParams()
  const slug = params?.slug as string

  useEffect(() => {
    if (!slug) return

    // Step 1: Open retailer in new tab (affiliate click fires)
    window.open(`/go-r/${slug}`, '_blank')

    // Step 2: Navigate THIS tab to the Giftist product page
    // Small delay to ensure the new tab opens first
    setTimeout(() => {
      window.location.href = `/p/${slug}?from=wa`
    }, 200)
  }, [slug])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-gray-400 mb-2">Opening your gift...</div>
        <div className="text-xs text-gray-300">🎁</div>
      </div>
    </div>
  )
}
