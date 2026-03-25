'use client'

import { useEffect, useState } from 'react'
import { Crown, Sparkles, Zap, Star, ExternalLink, MessageCircle, User } from 'lucide-react'

interface SubscriptionData {
  status: string
  currentPeriodEnd?: string
}

interface CreditsData {
  messageCredits: number
  profileCredits: number
}

export default function GoldUpgradeCard() {
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/subscription').then(r => r.json()),
      fetch('/api/credits').then(r => r.json()),
    ])
      .then(([subData, creditsData]) => {
        setSub(subData)
        setCredits(creditsData)
      })
      .catch(() => {
        setSub({ status: 'INACTIVE' })
        setCredits({ messageCredits: 0, profileCredits: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  const handleUpgrade = async () => {
    setActionLoading('gold')
    try {
      const res = await fetch('/api/subscription/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Failed to start checkout')
    } catch {
      alert('Failed to start checkout')
    } finally {
      setActionLoading(null)
    }
  }

  const handleManage = async () => {
    setActionLoading('manage')
    try {
      const res = await fetch('/api/subscription/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Failed to open portal')
    } catch {
      alert('Failed to open portal')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBuyCredits = async () => {
    setActionLoading('credits')
    try {
      const res = await fetch('/api/credits/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Failed to start checkout')
    } catch {
      alert('Failed to start checkout')
    } finally {
      setActionLoading(null)
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
  const hasCredits = (credits?.messageCredits ?? 0) > 0 || (credits?.profileCredits ?? 0) > 0

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
                <h2 className="text-lg font-semibold text-gray-900">Giftist Gold</h2>
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
          disabled={actionLoading === 'manage'}
          className="flex items-center gap-2 px-4 py-2 bg-surface-hover text-gray-900 rounded-lg text-sm font-medium hover:bg-surface-raised transition disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4" />
          {actionLoading === 'manage' ? 'Opening...' : 'Manage Subscription'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Credits status */}
      {hasCredits && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Your Credits</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-sm text-secondary"><strong>{credits?.messageCredits}</strong> messages</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm text-secondary"><strong>{credits?.profileCredits}</strong> taste profiles</span>
            </div>
          </div>
        </div>
      )}

      {/* Credit Pack */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Credit Pack</h2>
            <p className="text-sm text-muted">50 messages + 5 taste profiles</p>
          </div>
          <div className="p-2 bg-primary/10 rounded-full">
            <Zap className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-secondary">50 extra concierge messages</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-secondary">5 extra taste profile analyses</span>
          </div>
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-secondary">Credits never expire</span>
          </div>
        </div>

        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-2xl font-bold text-gray-900">$5</span>
          <span className="text-sm text-muted">one-time</span>
        </div>

        <button
          onClick={handleBuyCredits}
          disabled={actionLoading === 'credits'}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          {actionLoading === 'credits' ? 'Setting up...' : 'Buy Credit Pack'}
        </button>
      </div>

      {/* Gold tier */}
      <div className="bg-surface rounded-xl border border-yellow-500/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upgrade to Gold</h2>
            <p className="text-sm text-muted">Unlimited everything</p>
          </div>
          <div className="p-2 bg-yellow-500/10 rounded-full">
            <Crown className="h-5 w-5 text-yellow-500" />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm text-secondary">Unlimited concierge conversations</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm text-secondary">Unlimited taste profile analyses</span>
          </div>
          <div className="flex items-center gap-3">
            <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm text-secondary">Priority AI recommendations</span>
          </div>
        </div>

        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-2xl font-bold text-gray-900">$4.99</span>
          <span className="text-sm text-muted">/month</span>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={actionLoading === 'gold'}
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-black py-3 rounded-lg font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
        >
          <Crown className="h-4 w-4" />
          {actionLoading === 'gold' ? 'Setting up...' : 'Upgrade to Gold'}
        </button>
      </div>
    </div>
  )
}
