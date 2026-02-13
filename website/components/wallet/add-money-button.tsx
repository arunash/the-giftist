'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const presetAmounts = [25, 50, 100, 200]

export function AddMoneyButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDeposit(amount: number) {
    setLoading(true)
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Deposit error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-hover transition"
      >
        <Plus className="h-4 w-4" />
        Add Money
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Add Money</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {presetAmounts.map((amount) => (
          <button
            key={amount}
            onClick={() => handleDeposit(amount)}
            disabled={loading}
            className={cn(
              'py-3 rounded-lg font-semibold text-lg transition',
              'border-2 border-gray-200 hover:border-primary hover:text-primary',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            ${amount}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Custom"
            min="1"
            max="10000"
            className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => {
            const amt = parseFloat(customAmount)
            if (amt >= 1) handleDeposit(amt)
          }}
          disabled={loading || !customAmount || parseFloat(customAmount) < 1}
          className="bg-primary text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  )
}
