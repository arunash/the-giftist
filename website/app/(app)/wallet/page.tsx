'use client'

import { useEffect, useState, useCallback } from 'react'
import { BalanceCard } from '@/components/wallet/balance-card'
import { AddMoneyButton } from '@/components/wallet/add-money-button'
import { TransactionRow } from '@/components/wallet/transaction-row'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Wallet, Gift } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null)
  const [unfundedItems, setUnfundedItems] = useState<any[]>([])
  const [fundingItem, setFundingItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [walletRes, itemsRes] = await Promise.all([
        fetch('/api/wallet'),
        fetch('/api/items'),
      ])
      const walletData = await walletRes.json()
      const itemsData = await itemsRes.json()

      setWallet(walletData)
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

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Wallet</h1>

        <BalanceCard balance={wallet?.balance || 0} />

        <AddMoneyButton />

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
