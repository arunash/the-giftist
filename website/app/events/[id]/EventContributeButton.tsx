'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { DollarSign, X, Info } from 'lucide-react'

interface EventContributeButtonProps {
  eventId: string
  eventName: string
  ownerName?: string
}

export default function EventContributeButton({
  eventId,
  eventName,
  ownerName,
}: EventContributeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [contributorEmail, setContributorEmail] = useState('')

  const suggestedAmounts = [25, 50, 100, 200]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)

    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          amount: numAmount,
          message: message || null,
          isAnonymous,
          contributorEmail: contributorEmail || null,
          returnUrl: window.location.pathname,
        }),
      })

      const data = await res.json()

      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Failed to contribute')
        setLoading(false)
      }
    } catch (error) {
      console.error(error)
      alert('Failed to contribute')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-hover transition"
      >
        <DollarSign className="h-4 w-4" />
        Contribute to Gift Fund
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 relative border border-border max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-gray-900 transition"
            >
              <X className="h-6 w-6" />
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-2">Contribute to Gift Fund</h2>
            <p className="text-muted text-sm mb-4">{eventName}</p>

            <div className="flex gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-5">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                You&apos;re contributing to the overall gift fund.{' '}
                {ownerName || 'The recipient'} will allocate funds to specific items.
                You&apos;ll be notified when gifts are purchased.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Select Amount</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {suggestedAmounts.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount(String(a))}
                      className={`py-2 rounded-lg font-medium transition ${
                        amount === String(a)
                          ? 'bg-primary text-white'
                          : 'bg-surface-hover text-gray-900 hover:bg-surface-raised'
                      }`}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Custom amount"
                    min="1"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Message (optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={2}
                  className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Your email (optional, for updates)</label>
                <input
                  type="email"
                  value={contributorEmail}
                  onChange={(e) => setContributorEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary bg-surface-hover"
                />
                <span className="text-sm text-muted">Contribute anonymously</span>
              </label>

              <button
                type="submit"
                disabled={loading || !amount}
                className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Contribute ${amount ? formatPrice(parseFloat(amount)) : ''}`}
              </button>

              <p className="text-xs text-muted text-center">Secure payment via Stripe</p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
