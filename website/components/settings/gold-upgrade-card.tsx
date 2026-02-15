'use client'

import { useEffect, useState } from 'react'
import { Crown, Sparkles, Zap, Star, ExternalLink } from 'lucide-react'

interface SubscriptionData {
  status: string
  currentPeriodEnd?: string
}

export default function GoldUpgradeCard() {
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetch('/api/subscription')
      .then((r) => r.json())
      .then((data) => setSub(data))
      .catch(() => setSub({ status: 'INACTIVE' }))
      .finally(() => setLoading(false))
  }, [])

  const handleUpgrade = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/subscription/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Failed to start checkout')
      }
    } catch {
      alert('Failed to start checkout')
    } finally {
      setActionLoading(false)
    }
  }

  const handleManage = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/subscription/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Failed to open portal')
      }
    } catch {
      alert('Failed to open portal')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-surface-hover rounded w-1/3" />
          <div className="h-4 bg-surface-hover rounded w-2/3" />
        </div>
      </div>
    )
  }

  const isActive = sub?.status === 'ACTIVE'

  if (isActive) {
    return (
      <div className="bg-surface rounded-xl border border-yellow-500/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-full">
              <Crown className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Giftist Gold</h2>
                <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-xs font-semibold rounded-full">
                  ACTIVE
                </span>
              </div>
              <p className="text-sm text-muted">
                {sub.currentPeriodEnd
                  ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                  : 'Subscription active'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleManage}
          disabled={actionLoading}
          className="flex items-center gap-2 px-4 py-2 bg-surface-hover text-white rounded-lg text-sm font-medium hover:bg-surface-raised transition disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4" />
          {actionLoading ? 'Opening...' : 'Manage Subscription'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Upgrade to Gold</h2>
          <p className="text-sm text-muted">Unlock premium features</p>
        </div>
        <div className="p-2 bg-yellow-500/10 rounded-full">
          <Crown className="h-5 w-5 text-yellow-500" />
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          <span className="text-sm text-secondary">Priority AI recommendations</span>
        </div>
        <div className="flex items-center gap-3">
          <Zap className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          <span className="text-sm text-secondary">Unlimited wishlists</span>
        </div>
        <div className="flex items-center gap-3">
          <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          <span className="text-sm text-secondary">Early access to new features</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold text-white">$4.99</span>
        <span className="text-sm text-muted">/month</span>
      </div>

      <button
        onClick={handleUpgrade}
        disabled={actionLoading}
        className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-black py-3 rounded-lg font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
      >
        <Crown className="h-4 w-4" />
        {actionLoading ? 'Setting up...' : 'Upgrade to Gold'}
      </button>
    </div>
  )
}
