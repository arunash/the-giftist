'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { BalanceCard } from '@/components/wallet/balance-card'
import { AddMoneyButton } from '@/components/wallet/add-money-button'
import { TransactionRow } from '@/components/wallet/transaction-row'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Wallet, Gift, Building2, ArrowDownToLine } from 'lucide-react'
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
  const searchParams = useSearchParams()

  const fetchData = useCallback(async () => {
    try {
      const [walletRes, itemsRes, connectRes] = await Promise.all([
        fetch('/api/wallet'),
        fetch('/api/items'),
        fetch('/api/stripe/connect/status'),
      ])
      const walletData = await walletRes.json()
      const itemsData = await itemsRes.json()
      const connectData = await connectRes.json()

      setWallet(walletData)
      setConnectStatus(connectData)
      // Get top 3 unfunded items
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

  // Re-check connect status when returning from Stripe onboarding
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
        <div className="max-w-2xl mx-auto animate-pulse space-y-6">
          <div className="h-32 bg-surface rounded-2xl" />
          <div className="h-12 bg-surface rounded-xl" />
          <div className="h-64 bg-surface rounded-xl" />
        </div>
      </div>
    )
  }

  const balance = wallet?.balance || 0

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Wallet</h1>

        <BalanceCard balance={balance} />

        <AddMoneyButton />

        {/* Stripe Connect / Withdraw Section */}
        <div className="bg-surface rounded-xl border border-border p-5">
          {!connectStatus?.onboarded ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-white">Withdraw to Bank</h3>
              </div>
              <p className="text-sm text-muted mb-4">
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
                <ArrowDownToLine className="h-5 w-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Withdraw to Bank</h3>
              </div>
              {balance > 0 ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        max={balance}
                        step="0.01"
                        className="w-full pl-7 pr-3 py-2.5 bg-surface-hover border border-border rounded-xl text-white placeholder-muted outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      onClick={() => setWithdrawAmount(balance.toFixed(2))}
                      className="px-3 py-2.5 text-xs font-medium text-primary border border-primary/20 rounded-xl hover:bg-primary/10 transition"
                    >
                      Max
                    </button>
                  </div>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    {withdrawing ? 'Processing...' : `Withdraw ${withdrawAmount ? formatPrice(parseFloat(withdrawAmount)) : ''}`}
                  </button>
                  {withdrawError && (
                    <p className="text-sm text-red-400">{withdrawError}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Bank connected. Add funds to your wallet to withdraw.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Fund Section */}
        {unfundedItems.length > 0 && (
          <div className="bg-surface rounded-xl border border-border p-5">
            <h3 className="font-semibold text-white mb-4">Quick Fund</h3>
            <div className="space-y-3">
              {unfundedItems.map((item) => {
                const goal = item.goalAmount || item.priceValue || 0
                const remaining = Math.max(0, goal - item.fundedAmount)
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-hover overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Gift className="h-4 w-4 text-[#333]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-muted">{formatPrice(remaining)} left</p>
                    </div>
                    <button
                      onClick={() => setFundingItem(item)}
                      className="text-sm font-medium text-primary hover:text-primary-hover px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary/10 transition"
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
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="font-semibold text-white mb-4">Transaction History</h3>
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
              description="Add money to your wallet to start funding items"
              className="py-8"
            />
          )}
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
