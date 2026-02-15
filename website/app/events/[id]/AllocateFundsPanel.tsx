'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { ArrowRight, Gift } from 'lucide-react'

interface AllocateFundsPanelProps {
  eventId: string
  fundedAmount: number
  items: { id: string; name: string; image: string | null; fundedAmount: number; goalAmount: number | null; priceValue: number | null }[]
}

export default function AllocateFundsPanel({
  eventId,
  fundedAmount: initialFundedAmount,
  items,
}: AllocateFundsPanelProps) {
  const [fundedAmount, setFundedAmount] = useState(initialFundedAmount)
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [allocating, setAllocating] = useState(false)
  const [success, setSuccess] = useState('')

  if (fundedAmount <= 0) return null

  const handleAllocate = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0 || !selectedItemId) return

    setAllocating(true)
    setSuccess('')
    try {
      const res = await fetch(`/api/events/${eventId}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selectedItemId, amount: numAmount }),
      })
      if (res.ok) {
        setFundedAmount((prev) => prev - numAmount)
        setAmount('')
        const item = items.find((i) => i.id === selectedItemId)
        setSuccess(`Allocated ${formatPrice(numAmount)} to ${item?.name || 'item'}`)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to allocate')
      }
    } catch {
      alert('Failed to allocate funds')
    } finally {
      setAllocating(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-gray-900">
          Unallocated Funds: {formatPrice(fundedAmount)}
        </h3>
      </div>
      <p className="text-sm text-amber-800 mb-4">
        Allocate these funds to specific items on the wishlist.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
          className="flex-1 px-3 py-2.5 bg-white border border-amber-200 rounded-lg text-sm text-gray-900 outline-none focus:border-primary"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({formatPrice(item.fundedAmount)} / {formatPrice(item.goalAmount || item.priceValue || 0)})
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              max={fundedAmount}
              step="0.01"
              className="w-28 pl-7 pr-3 py-2.5 bg-white border border-amber-200 rounded-lg text-sm text-gray-900 outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleAllocate}
            disabled={allocating || !amount || parseFloat(amount) <= 0}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-500 transition disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" />
            {allocating ? 'Allocating...' : 'Allocate'}
          </button>
        </div>
      </div>

      {success && (
        <p className="text-sm text-emerald-600 mt-3">{success}</p>
      )}
    </div>
  )
}
