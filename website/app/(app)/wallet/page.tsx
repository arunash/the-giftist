'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { AddMoneyButton } from '@/components/wallet/add-money-button'
import { TransactionRow } from '@/components/wallet/transaction-row'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Wallet, Gift, Building2, ArrowDownToLine, ArrowUpRight, ArrowDownLeft, Heart } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null)
  const [unfundedItems, setUnfundedItems] = useState<any[]>([])
  const [fundingItem, setFundingItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; onboarded: boolean } | null>(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [lifetimeReceived, setLifetimeReceived] = useState(0)
  const [receivedContributions, setReceivedContributions] = useState<any[]>([])
  const searchParams = useSearchParams()

  const fetchData = useCallback(async () => {
    try {
      const [walletRes, itemsRes, connectRes, contribRes] = await Promise.all([
        fetch('/api/wallet'),
        fetch('/api/items'),
        fetch('/api/stripe/connect/status'),
        fetch('/api/wallet/received'),
      ])
      const walletData = await walletRes.json()
      const itemsData = await itemsRes.json()
      const connectData = await connectRes.json()
      const contribData = await contribRes.json()

      setWallet(walletData)
      setConnectStatus(connectData)
      setLifetimeReceived(contribData?.lifetime || 0)
      setReceivedContributions(contribData?.contributions || [])
      const unfunded = (Array.isArray(itemsData) ? itemsData : [])
        .filter((item: any) => {
          const goal = item.goalAmount || item.priceValue || 0
          return goal > 0 && item.fundedAmount < goal && !item.isPurchased
        })
        .slice(0, 3)
      setUnfundedItems(unfunded)
    } catch (error) {
      console.error('Error fetching wallet data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (searchParams.get('connect') === 'complete') {
      fetch('/api/stripe/connect/status')
        .then((r) => r.json())
        .then(setConnectStatus)
        .catch(() => {})
    }
  }, [searchParams])

  const handleConnectBank = async () => {
    setConnectLoading(true)
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error starting Connect onboarding:', error)
    } finally {
      setConnectLoading(false)
    }
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) return

    setWithdrawing(true)
    setWithdrawError('')
    try {
      const res = await fetch('/api/stripe/connect/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setWithdrawError(data.error || 'Withdrawal failed')
      } else {
        setWithdrawAmount('')
        fetchData()
      }
    } catch {
      setWithdrawError('Withdrawal failed')
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Funds</h1>
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0 animate-pulse">
          <div className="space-y-4">
            <div className="h-36 bg-gray-100 rounded-2xl" />
            <div className="h-48 bg-gray-100 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <div className="h-36 bg-gray-100 rounded-2xl" />
            <div className="h-48 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  const balance = wallet?.balance || 0

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Funds</h1>

      {/* Two-panel layout */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">

        {/* ═══ LEFT PANEL: Funds Balance ═══ */}
        <div className="space-y-5">
          {/* Balance hero card */}
          <div className="ig-card !transform-none overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary-hover p-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="h-5 w-5 text-white/70" />
                <span className="text-sm font-medium text-white/70">Funds Balance</span>
              </div>
              <p className="text-4xl font-bold tracking-tight">{formatPrice(balance)}</p>
              <p className="text-sm text-white/60 mt-1">Available to send toward gifts</p>
            </div>
            <div className="p-4">
              <AddMoneyButton />
            </div>
          </div>

          {/* Quick Fund */}
          {unfundedItems.length > 0 && (
            <div className="ig-card !transform-none p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Fund</h3>
              <div className="space-y-3">
                {unfundedItems.map((item) => {
                  const goal = item.goalAmount || item.priceValue || 0
                  const remaining = Math.max(0, goal - item.fundedAmount)
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0 ig-image-wrap">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Gift className="h-4 w-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{formatPrice(remaining)} left</p>
                      </div>
                      <button
                        onClick={() => setFundingItem(item)}
                        className="text-sm font-medium text-primary hover:text-primary-hover px-3 py-1.5 rounded-full border border-primary/20 hover:bg-primary/10 transition"
                      >
                        Fund
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="ig-card !transform-none p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Transaction History</h3>
            {wallet?.transactions?.length > 0 ? (
              <div>
                {wallet.transactions.map((tx: any) => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Wallet className="h-12 w-12" />}
                title="No transactions yet"
                description="Add funds to start funding items"
                className="py-8"
              />
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL: Funds Received ═══ */}
        <div className="space-y-5">
          {/* Received hero card */}
          <div className="ig-card !transform-none overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="h-5 w-5 text-white/70" />
                <span className="text-sm font-medium text-white/70">Funds Received</span>
              </div>
              <p className="text-4xl font-bold tracking-tight">{formatPrice(lifetimeReceived)}</p>
              <p className="text-sm text-white/60 mt-1">
                {receivedContributions.length > 0
                  ? `From ${receivedContributions.length} contribution${receivedContributions.length !== 1 ? 's' : ''}`
                  : 'Contributions from friends & family'}
              </p>
            </div>
          </div>

          {/* Recent contributions list */}
          <div className="ig-card !transform-none p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Recent Contributions</h3>
            {receivedContributions.length > 0 ? (
              <div className="space-y-3">
                {receivedContributions.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0 ig-image-wrap">
                      {c.itemImage ? (
                        <img src={c.itemImage} alt={c.itemName || ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Heart className="h-4 w-4 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.itemName || c.eventName || 'Contribution'}</p>
                      <p className="text-xs text-gray-400">{c.contributorName || 'Anonymous'} &middot; {new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">+{formatPrice(c.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Heart className="h-12 w-12" />}
                title="No contributions yet"
                description="Share your wishlist so friends can contribute toward your gifts"
                className="py-8"
              />
            )}
          </div>

          {/* Withdraw to Bank */}
          <div className="ig-card !transform-none p-5">
            {!connectStatus?.onboarded ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-gray-900">Withdraw to Bank</h3>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Connect your bank account to withdraw funded money.
                </p>
                <button
                  onClick={handleConnectBank}
                  disabled={connectLoading}
                  className="w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover transition disabled:opacity-50"
                >
                  {connectLoading ? 'Connecting...' : 'Connect Bank Account'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <ArrowDownToLine className="h-5 w-5 text-emerald-500" />
                  <h3 className="font-semibold text-gray-900">Withdraw to Bank</h3>
                </div>
                {lifetimeReceived > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">Available to withdraw: <span className="font-semibold text-gray-900">{formatPrice(lifetimeReceived)}</span></p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00"
                          max={lifetimeReceived}
                          step="0.01"
                          className="w-full pl-7 pr-3 py-2.5 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                      </div>
                      <button
                        onClick={() => setWithdrawAmount(lifetimeReceived.toFixed(2))}
                        className="px-3 py-2.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition"
                      >
                        Max
                      </button>
                    </div>
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > lifetimeReceived}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      {withdrawing ? 'Processing...' : `Withdraw ${withdrawAmount ? formatPrice(parseFloat(withdrawAmount)) : ''}`}
                    </button>
                    {withdrawError && (
                      <p className="text-sm text-red-500">{withdrawError}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Bank connected. Funds will appear here when friends contribute.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {fundingItem && (
        <FundItemModal
          item={fundingItem}
          walletBalance={wallet?.balance || 0}
          onClose={() => setFundingItem(null)}
          onFunded={() => {
            setFundingItem(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
