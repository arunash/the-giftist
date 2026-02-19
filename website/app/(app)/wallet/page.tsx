'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { AddMoneyButton } from '@/components/wallet/add-money-button'
import { TransactionRow } from '@/components/wallet/transaction-row'
import { FundItemModal } from '@/components/wallet/fund-item-modal'
import BankOnboardingForm from '@/components/wallet/bank-onboarding-form'
import PayoutMethodPrompt from '@/components/payout-method-prompt'
import { EmptyState } from '@/components/ui/empty-state'
import { Wallet, Gift, Building2, ArrowDownToLine, ArrowUpRight, ArrowDownLeft, Heart, Sparkles, MessageSquare, DollarSign, Zap, Clock, Settings, CheckCircle2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null)
  const [unfundedItems, setUnfundedItems] = useState<any[]>([])
  const [allUnfundedItems, setAllUnfundedItems] = useState<any[]>([])
  const [fundingItem, setFundingItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connectStatus, setConnectStatus] = useState<any>(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState<'standard' | 'instant'>('standard')
  const [withdrawDestination, setWithdrawDestination] = useState<'VENMO' | 'PAYPAL' | 'STRIPE' | null>(null)
  const [lifetimeReceived, setLifetimeReceived] = useState(0)
  const [receivedContributions, setReceivedContributions] = useState<any[]>([])
  const [moveAmount, setMoveAmount] = useState('')
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [showPayoutPrompt, setShowPayoutPrompt] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
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
      setAllUnfundedItems(unfunded)
      setUnfundedItems(unfunded.slice(0, 3))
    } catch (error) {
      console.error('Error fetching wallet data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Fetch user info for payout prompt
    fetch('/api/auth/session').then(r => r.json()).then(data => {
      setUserName(data?.user?.name || '')
      setUserEmail(data?.user?.email || '')
    }).catch(() => {})
  }, [fetchData])

  // Default withdraw destination to preferred method once loaded
  useEffect(() => {
    if (connectStatus && !withdrawDestination) {
      const pref = connectStatus.preferredPayoutMethod
      if (pref === 'VENMO' && connectStatus.venmoHandle) setWithdrawDestination('VENMO')
      else if (pref === 'PAYPAL' && connectStatus.paypalEmail) setWithdrawDestination('PAYPAL')
      else if (connectStatus.onboarded) setWithdrawDestination('STRIPE')
      else if (connectStatus.venmoHandle) setWithdrawDestination('VENMO')
      else if (connectStatus.paypalEmail) setWithdrawDestination('PAYPAL')
    }
  }, [connectStatus, withdrawDestination])

  useEffect(() => {
    if (searchParams.get('connect') === 'complete') {
      fetch('/api/stripe/connect/status')
        .then((r) => r.json())
        .then(setConnectStatus)
        .catch(() => {})
    }
  }, [searchParams])

  const handleConnectBank = async () => {
    // Show the payout method selector instead of going straight to Stripe
    setShowPayoutPrompt(true)
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0 || !withdrawDestination) return

    setWithdrawing(true)
    setWithdrawError('')
    try {
      let res: Response

      if (withdrawDestination === 'VENMO' || withdrawDestination === 'PAYPAL') {
        res = await fetch('/api/paypal/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: withdrawDestination, amount }),
        })
      } else {
        res = await fetch('/api/stripe/connect/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, method: withdrawMethod }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setWithdrawError(data.error || 'Withdrawal failed')
      } else {
        setWithdrawAmount('')
        setWithdrawMethod('standard')
        fetchData()
      }
    } catch {
      setWithdrawError('Withdrawal failed')
    } finally {
      setWithdrawing(false)
    }
  }

  const handleMoveToWallet = async () => {
    const amount = parseFloat(moveAmount)
    if (!amount || amount <= 0) return

    setMoving(true)
    setMoveError('')
    try {
      const res = await fetch('/api/wallet/move-to-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMoveError(data.error || 'Transfer failed')
      } else {
        setMoveAmount('')
        fetchData()
      }
    } catch {
      setMoveError('Transfer failed')
    } finally {
      setMoving(false)
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
  const payoutMethod = connectStatus?.preferredPayoutMethod
  const payoutSetup = connectStatus?.payoutSetupComplete || connectStatus?.onboarded

  // Smart Fund Matching: find items where remaining <= balance
  const smartMatch = balance > 0
    ? allUnfundedItems
        .map((item: any) => {
          const goal = item.goalAmount || item.priceValue || 0
          const remaining = Math.max(0, goal - item.fundedAmount)
          return { ...item, remaining }
        })
        .filter((item: any) => item.remaining > 0 && item.remaining <= balance)
        .sort((a: any, b: any) => a.remaining - b.remaining)[0] || null
    : null

  // Check for high-value items
  const hasHighValueItems = allUnfundedItems.some((item: any) => {
    const goal = item.goalAmount || item.priceValue || 0
    return goal > 50
  })

  const withdrawMethodLabel = withdrawDestination === 'VENMO' ? 'Venmo'
    : withdrawDestination === 'PAYPAL' ? 'PayPal'
    : 'Bank'

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Funds</h1>

      {/* Two-panel layout */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">

        {/* LEFT PANEL: Funds Balance */}
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

          {/* Smart Fund Match Card */}
          {smartMatch && (
            <div className="ig-card !transform-none overflow-hidden border-emerald-200">
              <div className="bg-emerald-500/5 border-b border-emerald-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-emerald-800">Perfect Match</h3>
                </div>
                <p className="text-sm text-emerald-700">
                  You have <span className="font-semibold">{formatPrice(balance)}</span> and{' '}
                  <span className="font-semibold">&ldquo;{smartMatch.name}&rdquo;</span> needs just{' '}
                  <span className="font-semibold">{formatPrice(smartMatch.remaining)}</span> &mdash; use your funds?
                </p>
                <button
                  onClick={() => setFundingItem(smartMatch)}
                  className="mt-3 w-full py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 transition text-sm"
                >
                  Fund This Item
                </button>
              </div>
            </div>
          )}

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

          {/* Wallet Insights */}
          {allUnfundedItems.length > 0 && (
            <div className="ig-card !transform-none p-5 bg-blue-500/5 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  {balance === 0 && allUnfundedItems.length > 0 ? (
                    <p className="text-sm text-blue-800">
                      Add funds to quickly contribute to items on your list.
                    </p>
                  ) : hasHighValueItems ? (
                    <>
                      <p className="text-sm text-blue-800">
                        Have expensive items? Split the cost among friends for faster funding.
                      </p>
                      <Link
                        href="/chat?q=Help me split the cost of an expensive gift among friends"
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 mt-1.5 transition"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Ask your concierge
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-blue-800">
                        Items get funded 3x faster when shared on WhatsApp. Share your event links!
                      </p>
                      <Link
                        href="/events"
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 mt-1.5 transition"
                      >
                        View events
                      </Link>
                    </>
                  )}
                </div>
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

        {/* RIGHT PANEL: Funds Received */}
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

          {/* Use for Gifts — move received funds to wallet */}
          {lifetimeReceived > 0 && (
            <div className="ig-card !transform-none p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold text-gray-900">Use for Gifts</h3>
              </div>
              <p className="text-sm text-gray-500 mb-3">Move received funds to your wallet to spend on gifts instantly — no fees.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={moveAmount}
                    onChange={(e) => setMoveAmount(e.target.value)}
                    placeholder="0.00"
                    max={lifetimeReceived}
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2.5 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={() => setMoveAmount(lifetimeReceived.toFixed(2))}
                  className="px-3 py-2.5 text-xs font-medium text-primary border border-primary/20 rounded-xl hover:bg-primary/10 transition"
                >
                  Max
                </button>
              </div>
              <button
                onClick={handleMoveToWallet}
                disabled={moving || !moveAmount || parseFloat(moveAmount) <= 0 || parseFloat(moveAmount) > lifetimeReceived}
                className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover transition disabled:opacity-50"
              >
                {moving ? 'Moving...' : `Move ${moveAmount ? formatPrice(parseFloat(moveAmount)) : ''} to Wallet`}
              </button>
              {moveError && <p className="text-sm text-red-500 mt-2">{moveError}</p>}
            </div>
          )}

          {/* Recent contributions list */}
          <div className="ig-card !transform-none p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Recent Contributions</h3>
            {receivedContributions.length > 0 ? (
              <div className="space-y-3">
                {receivedContributions.map((c: any) => (
                  <Link key={c.id} href={c.itemId ? `/items/${c.itemId}` : '#'} className="flex items-center gap-3 hover:bg-surface-hover rounded-lg px-1 -mx-1 py-1 transition">
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
                  </Link>
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

          {/* Payout Method Status + Nudge */}
          {payoutSetup && (() => {
            const methodsConfigured = [
              connectStatus?.venmoHandle ? 'Venmo' : null,
              connectStatus?.paypalEmail ? 'PayPal' : null,
              connectStatus?.onboarded ? 'Bank' : null,
            ].filter(Boolean)
            const methodsMissing = [
              !connectStatus?.venmoHandle ? 'Venmo' : null,
              !connectStatus?.paypalEmail ? 'PayPal' : null,
              !connectStatus?.onboarded ? 'Bank' : null,
            ].filter(Boolean)
            return methodsMissing.length > 0 ? (
              <div className="ig-card !transform-none p-5 bg-amber-500/5 border-amber-200">
                <h3 className="font-semibold text-gray-900 mb-3">Payout Methods</h3>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    {connectStatus?.venmoHandle
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
                    <span className="text-sm text-gray-700">Venmo {connectStatus?.venmoHandle ? <span className="text-gray-400">({connectStatus.venmoHandle})</span> : <span className="text-gray-400">(not set up)</span>}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {connectStatus?.paypalEmail
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
                    <span className="text-sm text-gray-700">PayPal {connectStatus?.paypalEmail ? <span className="text-gray-400">({connectStatus.paypalEmail})</span> : <span className="text-gray-400">(not set up)</span>}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {connectStatus?.onboarded
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
                    <span className="text-sm text-gray-700">Bank {connectStatus?.onboarded ? <span className="text-gray-400">(connected)</span> : <span className="text-gray-400">(not set up)</span>}</span>
                  </div>
                </div>
                <p className="text-xs text-amber-700 mb-3">
                  Set up {methodsMissing.join(' & ')} to receive direct transfers from contributors using {methodsMissing.length === 1 ? 'that method' : 'those methods'}.
                </p>
                <button
                  onClick={() => setShowPayoutPrompt(true)}
                  className="w-full py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-xl hover:bg-amber-50 transition"
                >
                  Add {methodsMissing.join(' & ')}
                </button>
              </div>
            ) : null
          })()}

          {/* Withdraw Section */}
          <div className="ig-card !transform-none p-5">
            {!payoutSetup ? (
              /* No payout method configured */
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-gray-900">Withdraw Funds</h3>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Set up a payout method to withdraw your gift funds.
                </p>
                <button
                  onClick={handleConnectBank}
                  disabled={connectLoading}
                  className="w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover transition disabled:opacity-50"
                >
                  {connectLoading ? 'Loading...' : 'Set Up Payout Method'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <ArrowDownToLine className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-semibold text-gray-900">Withdraw Funds</h3>
                  </div>
                  <button onClick={() => setShowPayoutPrompt(true)} className="text-gray-400 hover:text-gray-600">
                    <Settings className="h-4 w-4" />
                  </button>
                </div>

                {/* Destination picker */}
                {(() => {
                  const destinations: { key: 'VENMO' | 'PAYPAL' | 'STRIPE'; label: string; detail: string; icon: React.ReactNode }[] = []
                  if (connectStatus?.venmoHandle) destinations.push({ key: 'VENMO', label: 'Venmo', detail: connectStatus.venmoHandle, icon: <span className="text-white font-bold text-xs">V</span> })
                  if (connectStatus?.paypalEmail) destinations.push({ key: 'PAYPAL', label: 'PayPal', detail: connectStatus.paypalEmail, icon: <span className="text-white font-bold text-xs">P</span> })
                  if (connectStatus?.onboarded) destinations.push({ key: 'STRIPE', label: 'Bank', detail: 'Direct deposit', icon: <Building2 className="h-3.5 w-3.5 text-white" /> })

                  return destinations.length > 1 ? (
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-500 mb-2">Transfer to</label>
                      <div className="flex gap-2">
                        {destinations.map((d) => (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => setWithdrawDestination(d.key)}
                            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-sm font-medium transition border ${
                              withdrawDestination === d.key
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-emerald-200'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                              d.key === 'VENMO' ? 'bg-blue-500' : d.key === 'PAYPAL' ? 'bg-blue-700' : 'bg-gray-500'
                            }`}>
                              {d.icon}
                            </div>
                            <span>{d.label}</span>
                          </button>
                        ))}
                      </div>
                      {withdrawDestination && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          {destinations.find(d => d.key === withdrawDestination)?.detail}
                        </p>
                      )}
                    </div>
                  ) : destinations.length === 1 ? (
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        destinations[0].key === 'VENMO' ? 'bg-blue-500' : destinations[0].key === 'PAYPAL' ? 'bg-blue-700' : 'bg-gray-500'
                      }`}>
                        {destinations[0].icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Withdraw to {destinations[0].label}</p>
                        <p className="text-xs text-gray-400">{destinations[0].detail}</p>
                      </div>
                    </div>
                  ) : null
                })()}

                {/* Bank: standard/instant toggle */}
                {withdrawDestination === 'STRIPE' && connectStatus?.onboarded && (() => {
                  const withdrawable = connectStatus?.availableBalance || 0
                  const pending = connectStatus?.pendingBalance || Math.max(0, lifetimeReceived - withdrawable)
                  const parsedAmount = parseFloat(withdrawAmount) || 0
                  const instantFee = Math.max(parsedAmount * 0.01, 0.50)
                  const instantNet = parsedAmount - instantFee
                  return withdrawable > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">Available to withdraw: <span className="font-semibold text-gray-900">{formatPrice(withdrawable)}</span></p>
                      {pending > 0 && (
                        <p className="text-xs text-amber-600">{formatPrice(pending)} pending — available in 1-2 business days</p>
                      )}
                      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                        <button
                          onClick={() => setWithdrawMethod('standard')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
                            withdrawMethod === 'standard'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Standard (free)
                        </button>
                        <button
                          onClick={() => connectStatus?.instantEligible && setWithdrawMethod('instant')}
                          disabled={!connectStatus?.instantEligible}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
                            withdrawMethod === 'instant'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : connectStatus?.instantEligible
                                ? 'text-gray-500 hover:text-gray-700'
                                : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Instant (1% fee)
                        </button>
                      </div>
                      {!connectStatus?.instantEligible && withdrawMethod === 'standard' && (
                        <p className="text-xs text-gray-400">Instant payouts require a debit card — add one during bank setup.</p>
                      )}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.00"
                            max={withdrawable}
                            step="0.01"
                            className="w-full pl-7 pr-3 py-2.5 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                        <button
                          onClick={() => setWithdrawAmount(withdrawable.toFixed(2))}
                          className="px-3 py-2.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition"
                        >
                          Max
                        </button>
                      </div>
                      {withdrawMethod === 'instant' && parsedAmount > 0 && (
                        <div className="flex justify-between text-sm px-1">
                          <span className="text-gray-500">{formatPrice(instantFee)} fee</span>
                          <span className="font-medium text-gray-900">You receive {formatPrice(Math.max(0, instantNet))}</span>
                        </div>
                      )}
                      <button
                        onClick={handleWithdraw}
                        disabled={withdrawing || !withdrawAmount || parsedAmount <= 0 || parsedAmount > withdrawable || (withdrawMethod === 'instant' && instantNet < 1)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        {withdrawing ? 'Processing...' : withdrawMethod === 'instant'
                          ? `Instant Withdraw ${withdrawAmount ? formatPrice(parsedAmount) : ''}`
                          : `Withdraw ${withdrawAmount ? formatPrice(parsedAmount) : ''} to Bank`}
                      </button>
                      {withdrawMethod === 'instant' && (
                        <p className="text-xs text-gray-400 text-center">Arrives in minutes to your debit card</p>
                      )}
                      {withdrawError && <p className="text-sm text-red-500">{withdrawError}</p>}
                    </div>
                  ) : lifetimeReceived > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-600 font-medium">{formatPrice(lifetimeReceived)} pending</p>
                      <p className="text-xs text-gray-400">Funds will be available to withdraw in 1-2 business days.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Funds will appear here when friends contribute.</p>
                  )
                })()}

                {/* Venmo / PayPal withdraw form */}
                {(withdrawDestination === 'VENMO' || withdrawDestination === 'PAYPAL') && renderWithdrawForm()}

                {/* Stripe not yet onboarded but selected as preferred */}
                {withdrawDestination === 'STRIPE' && !connectStatus?.onboarded && (
                  <div>
                    <p className="text-sm text-gray-400 mb-4">Complete your bank setup to start withdrawing.</p>
                    <BankOnboardingForm userName={userName} onSuccess={() => fetchData()} />
                  </div>
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

      {showPayoutPrompt && (
        <PayoutMethodPrompt
          userName={userName}
          userEmail={userEmail}
          onComplete={() => {
            setShowPayoutPrompt(false)
            fetchData()
          }}
          onDismiss={() => setShowPayoutPrompt(false)}
        />
      )}
    </div>
  )

  // Shared withdraw form for Venmo/PayPal
  function renderWithdrawForm() {
    const withdrawable = lifetimeReceived
    const parsedAmount = parseFloat(withdrawAmount) || 0

    return withdrawable > 0 ? (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">Available to withdraw: <span className="font-semibold text-gray-900">{formatPrice(withdrawable)}</span></p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              max={withdrawable}
              step="0.01"
              className="w-full pl-7 pr-3 py-2.5 bg-gray-50 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <button
            onClick={() => setWithdrawAmount(withdrawable.toFixed(2))}
            className="px-3 py-2.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition"
          >
            Max
          </button>
        </div>
        <button
          onClick={handleWithdraw}
          disabled={withdrawing || !withdrawAmount || parsedAmount <= 0 || parsedAmount > withdrawable}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-50"
        >
          {withdrawing ? 'Processing...' : `Withdraw ${withdrawAmount ? formatPrice(parsedAmount) : ''} to ${withdrawMethodLabel}`}
        </button>
        <p className="text-xs text-gray-400 text-center">Free — arrives within minutes</p>
        {withdrawError && <p className="text-sm text-red-500">{withdrawError}</p>}
      </div>
    ) : lifetimeReceived > 0 ? (
      <div className="space-y-2">
        <p className="text-sm text-amber-600 font-medium">{formatPrice(lifetimeReceived)} pending</p>
        <p className="text-xs text-gray-400">Funds will be available to withdraw shortly.</p>
      </div>
    ) : (
      <p className="text-sm text-gray-400">
        Funds will appear here when friends contribute.
      </p>
    )
  }
}
