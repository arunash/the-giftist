'use client'

import { useEffect } from 'react'

export default function ViewTracker({ shareId }: { shareId: string }) {
  useEffect(() => {
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId }),
    }).catch(() => {})
  }, [shareId])

  return null
}
