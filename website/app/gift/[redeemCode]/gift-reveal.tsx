'use client'

import { useState, useEffect } from 'react'

interface GiftRevealProps {
  senderName: string
  onRevealComplete: () => void
}

export function GiftReveal({ senderName, onRevealComplete }: GiftRevealProps) {
  const [phase, setPhase] = useState<'intro' | 'shake' | 'open' | 'burst' | 'done'>('intro')

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('shake'), 800),
      setTimeout(() => setPhase('open'), 2200),
      setTimeout(() => setPhase('burst'), 2600),
      setTimeout(() => setPhase('done'), 3400),
      setTimeout(() => onRevealComplete(), 3800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onRevealComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 overflow-hidden">
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
              background: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'][i % 5],
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Confetti burst */}
      {(phase === 'burst' || phase === 'done') && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => {
            const angle = (i / 50) * 360
            const distance = 200 + Math.random() * 300
            const x = Math.cos((angle * Math.PI) / 180) * distance
            const y = Math.sin((angle * Math.PI) / 180) * distance
            const colors = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#f43f5e']
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: `${Math.random() * 10 + 6}px`,
                  height: `${Math.random() * 10 + 6}px`,
                  background: colors[i % colors.length],
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${Math.random() * 360}deg)`,
                  opacity: phase === 'done' ? 0 : 1,
                  transition: `transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease-out 0.5s`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* Central gift box */}
      <div className="relative flex flex-col items-center">
        {/* Sender text */}
        <p
          className="text-white/80 text-lg font-medium mb-8 transition-all duration-700"
          style={{
            opacity: phase === 'intro' ? 0 : 1,
            transform: phase === 'intro' ? 'translateY(10px)' : 'translateY(0)',
          }}
        >
          {senderName} sent you a gift!
        </p>

        {/* Gift box */}
        <div
          className="relative transition-all duration-500"
          style={{
            animation:
              phase === 'shake'
                ? 'gift-shake 0.4s ease-in-out infinite'
                : undefined,
            transform:
              phase === 'open' || phase === 'burst' || phase === 'done'
                ? 'scale(1.15)'
                : 'scale(1)',
            opacity: phase === 'done' ? 0 : 1,
          }}
        >
          {/* Box lid */}
          <div
            className="relative z-10 transition-all duration-500 ease-out"
            style={{
              transform:
                phase === 'open' || phase === 'burst' || phase === 'done'
                  ? 'translateY(-60px) rotateX(-30deg) scale(0.9)'
                  : 'translateY(0)',
              opacity:
                phase === 'burst' || phase === 'done' ? 0 : 1,
            }}
          >
            {/* Lid top */}
            <div className="w-36 h-10 bg-gradient-to-b from-rose-400 to-rose-500 rounded-t-2xl shadow-lg relative">
              {/* Bow */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <div className="relative">
                  <div className="w-8 h-8 bg-yellow-400 rounded-full shadow-md" />
                  <div className="absolute top-1 -left-5 w-10 h-6 bg-yellow-400 rounded-full -rotate-12 shadow-sm" />
                  <div className="absolute top-1 -right-5 w-10 h-6 bg-yellow-400 rounded-full rotate-12 shadow-sm" />
                </div>
              </div>
              {/* Lid ribbon */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-yellow-400/60" />
            </div>
          </div>

          {/* Box body */}
          <div className="w-36 h-28 bg-gradient-to-b from-rose-500 to-rose-600 rounded-b-xl shadow-xl relative -mt-1">
            {/* Ribbon vertical */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-yellow-400/50" />
            {/* Glow when opening */}
            {(phase === 'open' || phase === 'burst') && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-24 h-16 bg-yellow-300/40 blur-xl rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Tap hint */}
        <p
          className="text-white/50 text-sm mt-8 transition-opacity duration-500"
          style={{ opacity: phase === 'shake' ? 1 : 0 }}
        >
          Opening your gift...
        </p>
      </div>

      <style jsx>{`
        @keyframes gift-shake {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-5deg); }
          40% { transform: rotate(5deg); }
          60% { transform: rotate(-3deg); }
          80% { transform: rotate(3deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  )
}
