'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { DollarSign, X, Heart } from 'lucide-react'

interface ContributeButtonProps {
  itemId: string
  itemName: string
  remaining: number
}

export default function ContributeButton({
  itemId,
  itemName,
  remaining,
}: ContributeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  const suggestedAmounts = [10, 25, 50, 100].filter((a) => a <= remaining)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)

    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (numAmount > remaining) {
      alert(`Maximum contribution is ${formatPrice(remaining)}`)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          amount: numAmount,
          message: message || null,
          isAnonymous,
        }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          setIsOpen(false)
          setSuccess(false)
          setAmount('')
          setMessage('')
          window.location.reload()
        }, 2000)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to contribute')
      }
    } catch (error) {
      console.error(error)
      alert('Failed to contribute')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex-1 flex items-center justify-center gap-1 bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-hover transition"
      >
        <DollarSign className="h-4 w-4" />
        Contribute
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>

            {success ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 text-success mb-4">
                  <Heart className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-secondary mb-2">
                  Thank You!
                </h2>
                <p className="text-gray-600">
                  Your contribution means a lot!
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-secondary mb-2">
                  Contribute to Gift
                </h2>
                <p className="text-gray-600 text-sm mb-6 line-clamp-2">
                  {itemName}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Suggested Amounts */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Amount
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {suggestedAmounts.map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAmount(String(a))}
                          className={`py-2 rounded-lg font-medium transition ${
                            amount === String(a)
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          ${a}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Custom amount"
                        min="1"
                        max={remaining}
                        step="0.01"
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                        required
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatPrice(remaining)} remaining to fully fund
                    </p>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message (optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Add a personal message..."
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none"
                    />
                  </div>

                  {/* Anonymous */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-gray-600">
                      Contribute anonymously
                    </span>
                  </label>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !amount}
                    className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    {loading
                      ? 'Processing...'
                      : `Contribute ${amount ? formatPrice(parseFloat(amount)) : ''}`}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Secure payment powered by Stripe
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
