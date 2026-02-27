'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setVisible(false)
    // Grant GA consent
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      ;(window as any).gtag('consent', 'update', { analytics_storage: 'granted' })
    }
  }

  const decline = () => {
    localStorage.setItem('cookie-consent', 'declined')
    setVisible(false)
    // Disable GA tracking
    if (typeof window !== 'undefined') {
      (window as any)['ga-disable-G-841LSWCK86'] = true
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-lg mx-auto bg-surface border border-border rounded-2xl shadow-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm text-muted flex-1">
          We use cookies to improve your experience and analyze site traffic.{' '}
          <Link href="/privacy" className="underline hover:text-gray-900">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={decline}
            className="px-3 py-1.5 text-xs font-medium text-muted hover:text-gray-900 transition"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
