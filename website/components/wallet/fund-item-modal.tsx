'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { formatPrice, getProgressPercentage } from '@/lib/utils'

interface FundItemModalProps {
  item: {
    id: string
    name: string
    image: string | null
    priceValue: number | null
    goalAmount: number | null
    fundedAmount: number
  }
  walletBalance: number
  onClose: () => void
  onFunded: () => void
}

export function FundItemModal({ item, walletBalance, onClose, onFunded }: FundItemModalProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const goal = item.goalAmount || item.priceValue || 0
  const remaining = Math.max(0, goal - item.fundedAmount)
  const progress = getProgressPercentage(item.fundedAmount, goal)

  async function handleFund() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    if (amt > walletBalance) {
      setError('Insufficient wallet balance')
      return
    }
    if (amt > remaining) {
      setError(`Maximum fundable amount is ${formatPrice(remaining)}`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wallet/fund-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, amount: amt }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to fund item')
        return
      }
      onFunded()
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Fund Item</h3>
          <button onClick={onClose} className="text-muted hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          {item.image && (
            <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
          )}
          <div>
            <p className="font-medium text-white">{item.name}</p>
            <p className="text-sm text-muted">{formatPrice(goal)} goal</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted">
            <span>{formatPrice(item.fundedAmount)} funded</span>
            <span>{formatPrice(remaining)} remaining</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-secondary mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              max={Math.min(walletBalance, remaining)}
              step="0.01"
              className="w-full pl-7 pr-3 py-2.5 bg-surface-hover border border-border rounded-lg text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <p className="text-xs text-muted mt-1">Balance: {formatPrice(walletBalance)}</p>
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <button
          onClick={handleFund}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Funding...' : 'Fund Item'}
        </button>
      </div>
    </div>
  )
}
