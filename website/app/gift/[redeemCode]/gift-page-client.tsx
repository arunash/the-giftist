'use client'

import { useState, useCallback } from 'react'
import { GiftReveal } from './gift-reveal'

interface GiftPageClientProps {
  senderName: string
  showReveal: boolean
  children: React.ReactNode
}

export function GiftPageClient({ senderName, showReveal, children }: GiftPageClientProps) {
  const [revealed, setRevealed] = useState(!showReveal)

  const handleRevealComplete = useCallback(() => {
    setRevealed(true)
  }, [])

  return (
    <>
      {!revealed && (
        <GiftReveal
          senderName={senderName}
          onRevealComplete={handleRevealComplete}
        />
      )}
      <div
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
        }}
      >
        {children}
      </div>
    </>
  )
}
