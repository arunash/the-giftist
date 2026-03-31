'use client'

import { useEffect, useState, useMemo } from 'react'
import { Users, Package, MessageCircle, DollarSign, AlertTriangle, Activity, Crown, Globe, Phone, Mail, Zap, Send, Truck, ExternalLink, Loader2, Gift, Bell, BarChart3, Link2 } from 'lucide-react'

interface Stats {
  users: {
    total: number; newToday: number; newWeek: number
    withPhone: number; withEmail: number; withBoth: number
    active: number; gold: number
  }
  items: {
    total: number; today: number; week: number
    sourceBreakdown: Record<string, number>
    sourceBreakdownAll: Record<string, number>
    sourceBreakdownWeek: Record<string, number>
    avgPerUser: number
  }
  whatsapp: {
    total: number; today: number; week: number; failed: number
    statusBreakdown: Record<string, number>
    typeBreakdown: Record<string, number>
    outboundToday: number
    outboundTotal: number
    uniquePhonesToday: number
  }
  revenue: {
    platformFees: number; platformFeesToday: number
    contributions: number; contributionsToday: number
    contributionCount: number; contributionCountToday: number
    avgContribution: number; activeSubscriptions: number
    giftSendFees: number; giftSendFeesToday: number
    giftSendVolume: number; giftSendVolumeToday: number
    giftSendCount: number; giftSendCountToday: number
    giftSendByStatus: Record<string, number>
    recentGiftSends: Array<{
      id: string; itemName: string; amount: number; platformFee: number
      totalCharged: number; status: string; recipientName: string | null
      createdAt: string; sender: { name: string | null }
    }>
  }
  engagement: {
    totalEvents: number; totalCircleMembers: number
    totalChatMessages: number; chatMessagesToday: number
    eventsToday: number; eventsWeek: number
    circleMembersToday: number; circleMembersWeek: number
    chatMessagesWeek: number
    chatByRole: Record<string, number>
    uniqueChatUsersToday: number
  }
  costs: Record<string, { total: number; today: number; count: number; countToday: number }>
  costsTotalAll: number
  costsTotalToday: number
  errors: { today: number; week: number; bySource: Record<string, number>; bySourceToday: Record<string, number> }
  recentErrors: Array<{ id: string; source: string; message: string; createdAt: string }>
  recentUsers: Array<{ id: string; name: string | null; phone: string | null; email: string | null; createdAt: string; updatedAt: string; messageCredits: number; _count: { items: number; chatMessages: number } }>
  recentActivity: Array<{ id: string; type: string; createdAt: string; user: { name: string | null }; item: { name: string } | null; metadata: string | null }>
  itemsAddedToday: Array<{ id: string; name: string; source: string; price: string | null; priceValue: number | null; addedAt: string; user: { name: string | null } }>
  feedback: {
    positive: number
    negative: number
    recent: Array<{ id: string; rating: string; comment: string | null; source: string; createdAt: string; user: { name: string | null; phone: string | null } }>
  }
  reengagement: {
    smsSent: number
    whatsappSent: number
    emailSent: number
    activated: number
    eligible: number
    users: Array<{
      id: string
      name: string | null
      phone: string | null
      email: string | null
      items: number
      status: string
      channel: string | null
      sentAt: string | null
      createdAt: string
    }>
  }
  groupMonitoring: {
    activeGroups: number
    totalGroups: number
    bufferedMessages: number
    messagesToday: number
    profilesCreated: number
  }
  pnl: {
    totalRevenue: number
    totalFulfillmentCost: number
    totalGiftVolume: number
    details: Array<{
      id: string; itemName: string; amount: number; platformFee: number
      totalCharged: number; fulfillmentCost: number | null; status: string
      createdAt: string; senderName: string; stripeFee: number; netMargin: number
    }>
  }
  productClicks: {
    totalClicks: number
    totalLinks: number
    topClicked: Array<{ productName: string; clicks: number; source: string; targetUrl: string }>
  }
  analytics: {
    pageViews: { total: number; today: number; week: number; uniqueSessionsToday: number; uniqueSessionsWeek: number }
    topPages: Array<{ path: string; views: number }>
    topReferrers: Array<{ referrer: string; views: number }>
    topUtmSources: Array<{ source: string; views: number }>
    topUtmCampaigns: Array<{ campaign: string; views: number }>
    allProductClicks: Array<{
      id: string; slug: string; productName: string; targetUrl: string
      price: string | null; priceValue: number | null; image: string | null
      userId: string | null; source: string; clicks: number; lastReferrer: string | null
      createdAt: string; lastClicked: string | null
    }>
  }
}

function KpiCard({ icon: Icon, label, value, sub, children }: { icon: any; label: string; value: string | number; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl p-5 border border-border">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-sm text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
      {children && <div className="mt-3 pt-3 border-t border-border space-y-1">{children}</div>}
    </div>
  )
}

function Breakdown({ items }: { items: Array<{ label: string; value: string | number; color?: string }> }) {
  return (
    <>
      {items.map((item) => (
        <div key={item.label} className="flex justify-between text-xs">
          <span className="text-muted">{item.label}</span>
          <span className={item.color || 'text-foreground'}>{item.value}</span>
        </div>
      ))}
    </>
  )
}

function CostCard({ provider, data }: { provider: string; data: { total: number; today: number; count: number; countToday: number } }) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border">
      <p className="text-sm font-medium text-muted mb-1">{provider}</p>
      <p className="text-lg font-bold">${data.total.toFixed(4)}</p>
      <p className="text-xs text-muted">{data.count} calls total</p>
      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-xs text-primary">Today: ${data.today.toFixed(4)} ({data.countToday} calls)</p>
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    WHATSAPP: 'bg-green-500/20 text-green-400',
    MANUAL: 'bg-blue-500/20 text-blue-400',
    CHAT: 'bg-purple-500/20 text-purple-400',
    EXTENSION: 'bg-orange-500/20 text-orange-400',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[source] || 'bg-gray-500/20 text-gray-400'}`}>
      {source}
    </span>
  )
}

function SourceBar({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  const colors: Record<string, string> = {
    WHATSAPP: 'bg-green-500',
    MANUAL: 'bg-blue-500',
    CHAT: 'bg-purple-500',
    EXTENSION: 'bg-orange-500',
  }
  if (total === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex h-2 rounded-full overflow-hidden mb-2">
        {Object.entries(breakdown).map(([source, count]) => (
          <div
            key={source}
            className={`${colors[source] || 'bg-gray-500'}`}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ))}
      </div>
      {Object.entries(breakdown).map(([source, count]) => (
        <div key={source} className="flex justify-between text-xs">
          <span className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${colors[source] || 'bg-gray-500'}`} />
            <span className="text-muted">{source}</span>
          </span>
          <span>{count}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Sortable table utilities ─── */

type SortDir = 'asc' | 'desc'

function useSort<T extends string>(defaultKey: T, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<T>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)
  const toggle = (key: T) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }
  return { sortKey, sortDir, toggle }
}

function Th({ label, sortKey, active, dir, onClick, className }: {
  label: string; sortKey: string; active: boolean; dir: SortDir; onClick: (key: string) => void; className?: string
}) {
  return (
    <th
      className={`p-3 text-xs text-muted font-medium cursor-pointer hover:text-foreground select-none transition ${className || 'text-left'}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <span className={`text-[10px] ${active ? 'text-primary' : 'text-transparent'}`}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </span>
    </th>
  )
}

function sortBy<T>(data: T[], key: string, dir: SortDir): T[] {
  return [...data].sort((a, b) => {
    const resolve = (obj: any, path: string): any => {
      return path.split('.').reduce((o, k) => o?.[k], obj)
    }
    let aVal = resolve(a, key)
    let bVal = resolve(b, key)
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    if (aVal instanceof Date) aVal = aVal.getTime()
    if (bVal instanceof Date) bVal = bVal.getTime()
    return dir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
  })
}

interface GiftOrder {
  id: string; itemName: string; itemUrl: string | null; itemImage: string | null
  amount: number; platformFee: number; totalCharged: number; status: string
  redemptionMethod: string | null; senderName: string | null; recipientName: string
  recipientPhone: string; recipientEmail: string | null
  shippingName: string | null; shippingAddress: string | null
  shippingCity: string | null; shippingState: string | null; shippingZip: string | null
  trackingNumber: string | null; trackingUrl: string | null; fulfillmentCost: number | null
  redeemCode: string; createdAt: string; redeemedAt: string | null; shippedAt: string | null
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-gray-500/20 text-gray-400',
  PAID: 'bg-blue-500/20 text-blue-400',
  NOTIFIED: 'bg-blue-500/20 text-blue-400',
  REDEEMED: 'bg-green-500/20 text-green-400',
  REDEEMED_PENDING_SHIPMENT: 'bg-amber-500/20 text-amber-400',
  REDEEMED_PENDING_REWARD: 'bg-red-500/20 text-red-400',
  SHIPPED: 'bg-green-500/20 text-green-400',
  DELIVERED: 'bg-emerald-500/20 text-emerald-400',
}

const STATUS_LABEL: Record<string, string> = {
  REDEEMED_PENDING_SHIPMENT: 'Ship Pending',
  REDEEMED_PENDING_REWARD: 'Payout Failed',
  NOTIFIED: 'Notified',
}

function GiftFulfillmentSection() {
  const [tab, setTab] = useState<'shipments' | 'all'>('shipments')
  const [shipOrders, setShipOrders] = useState<GiftOrder[]>([])
  const [allOrders, setAllOrders] = useState<GiftOrder[]>([])
  const [loadingShip, setLoadingShip] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [allLoaded, setAllLoaded] = useState(false)
  const [shipping, setShipping] = useState<string | null>(null)
  const [shipForm, setShipForm] = useState<{ trackingNumber: string; trackingUrl: string; expectedDelivery: string; fulfillmentCost: string }>({ trackingNumber: '', trackingUrl: '', expectedDelivery: '', fulfillmentCost: '' })

  // Load shipment orders on mount
  useEffect(() => {
    fetch('/api/admin/fulfillment')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setShipOrders)
      .catch(console.error)
      .finally(() => setLoadingShip(false))
  }, [])

  // Load all orders on tab switch (lazy)
  useEffect(() => {
    if (tab === 'all' && !allLoaded) {
      setLoadingAll(true)
      fetch('/api/admin/fulfillment?tab=all')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then((data: GiftOrder[]) => { setAllOrders(data); setAllLoaded(true) })
        .catch(console.error)
        .finally(() => setLoadingAll(false))
    }
  }, [tab, allLoaded])

  const handleShip = async (orderId: string) => {
    const res = await fetch('/api/admin/fulfillment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        giftSendId: orderId,
        trackingNumber: shipForm.trackingNumber || undefined,
        trackingUrl: shipForm.trackingUrl || undefined,
        expectedDelivery: shipForm.expectedDelivery || undefined,
        fulfillmentCost: shipForm.fulfillmentCost ? parseFloat(shipForm.fulfillmentCost) : undefined,
      }),
    })
    if (res.ok) {
      const cost = shipForm.fulfillmentCost ? parseFloat(shipForm.fulfillmentCost) : null
      const updates = {
        status: 'SHIPPED',
        shippedAt: new Date().toISOString(),
        fulfillmentCost: cost,
        trackingNumber: shipForm.trackingNumber || null,
        trackingUrl: shipForm.trackingUrl || null,
      }
      setShipOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
      setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
      setShipping(null)
      setShipForm({ trackingNumber: '', trackingUrl: '', expectedDelivery: '', fulfillmentCost: '' })
    }
  }

  const [resending, setResending] = useState<string | null>(null)
  const shipSort = useSort<string>('status', 'asc')
  const allSort = useSort<string>('createdAt', 'desc')

  const handleResendNotification = async (orderId: string) => {
    setResending(orderId)
    try {
      const res = await fetch('/api/admin/fulfillment/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftSendId: orderId }),
      })
      if (res.ok) {
        alert('Notification sent!')
      } else {
        const data = await res.json()
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch {
      alert('Failed to resend notification')
    } finally {
      setResending(null)
    }
  }

  const pendingShip = shipOrders.filter(o => o.status === 'REDEEMED_PENDING_SHIPMENT')
  const shipped = shipOrders.filter(o => o.status === 'SHIPPED' || o.status === 'DELIVERED')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit">
        <button
          onClick={() => setTab('shipments')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            tab === 'shipments' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          Shipments
          {pendingShip.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold">{pendingShip.length}</span>}
        </button>
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            tab === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Gift className="h-3.5 w-3.5" />
          All Gifts
        </button>
      </div>

      {tab === 'shipments' ? (
        /* ─── Shipments Tab ─── */
        loadingShip ? (
          <div className="text-muted text-sm">Loading...</div>
        ) : shipOrders.length === 0 ? (
          <p className="text-muted text-sm">No shipping orders yet.</p>
        ) : (
          <>
            {pendingShip.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-300">{pendingShip.length} order{pendingShip.length > 1 ? 's' : ''} pending shipment</span>
              </div>
            )}
            <div className="bg-surface rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <Th label="Item" sortKey="itemName" active={shipSort.sortKey === 'itemName'} dir={shipSort.sortDir} onClick={shipSort.toggle} />
                    <Th label="Ship to" sortKey="shippingName" active={shipSort.sortKey === 'shippingName'} dir={shipSort.sortDir} onClick={shipSort.toggle} />
                    <Th label="Amount" sortKey="amount" active={shipSort.sortKey === 'amount'} dir={shipSort.sortDir} onClick={shipSort.toggle} />
                    <Th label="Status" sortKey="status" active={shipSort.sortKey === 'status'} dir={shipSort.sortDir} onClick={shipSort.toggle} />
                    <Th label="Redeemed" sortKey="redeemedAt" active={shipSort.sortKey === 'redeemedAt'} dir={shipSort.sortDir} onClick={shipSort.toggle} />
                    <th className="p-3 text-left text-xs text-muted font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortBy([...pendingShip, ...shipped], shipSort.sortKey, shipSort.sortDir).map(order => (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {order.itemImage && <img src={order.itemImage} alt="" className="w-8 h-8 rounded object-cover" />}
                          <div>
                            <p className="font-medium text-xs">{order.itemName}</p>
                            {order.itemUrl && (
                              <a href={order.itemUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-[10px] flex items-center gap-0.5 hover:underline">
                                <ExternalLink className="h-2.5 w-2.5" /> Buy link
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted">
                        <p className="font-medium text-foreground">{order.shippingName}</p>
                        <p>{order.shippingAddress}</p>
                        <p>{order.shippingCity}, {order.shippingState} {order.shippingZip}</p>
                      </td>
                      <td className="p-3 text-xs font-medium">${order.amount.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                          {STATUS_LABEL[order.status] || order.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted">{order.redeemedAt ? new Date(order.redeemedAt).toLocaleDateString() : '—'}</td>
                      <td className="p-3">
                        {shipping === order.id ? (
                          <div className="space-y-2 min-w-[200px]">
                            <input type="text" placeholder="Tracking number" value={shipForm.trackingNumber}
                              onChange={e => setShipForm(f => ({ ...f, trackingNumber: e.target.value }))}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                            <input type="text" placeholder="Tracking URL" value={shipForm.trackingUrl}
                              onChange={e => setShipForm(f => ({ ...f, trackingUrl: e.target.value }))}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                            <input type="date" value={shipForm.expectedDelivery}
                              onChange={e => setShipForm(f => ({ ...f, expectedDelivery: e.target.value }))}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                            <input type="number" step="0.01" placeholder="Actual cost ($)" value={shipForm.fulfillmentCost}
                              onChange={e => setShipForm(f => ({ ...f, fulfillmentCost: e.target.value }))}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                            <div className="flex gap-1">
                              <button onClick={() => handleShip(order.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                                <Truck className="h-3 w-3" /> {order.status === 'REDEEMED_PENDING_SHIPMENT' ? 'Ship' : 'Update'}
                              </button>
                              <button onClick={() => setShipping(null)}
                                className="px-2 py-1.5 bg-surface border border-border rounded-lg text-xs text-muted hover:text-foreground">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : order.status === 'REDEEMED_PENDING_SHIPMENT' ? (
                          <button onClick={() => { setShipping(order.id); setShipForm({ trackingNumber: '', trackingUrl: '', expectedDelivery: '', fulfillmentCost: '' }) }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                            <Truck className="h-3 w-3" /> Mark shipped
                          </button>
                        ) : (
                          <div>
                            <span className="text-xs text-muted">
                              {order.shippedAt && `Shipped ${new Date(order.shippedAt).toLocaleDateString()}`}
                              {order.fulfillmentCost != null && (
                                <span className="block text-[10px] text-green-500">Cost: ${order.fulfillmentCost.toFixed(2)}</span>
                              )}
                              {order.trackingUrl && (
                                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline mt-0.5">Track</a>
                              )}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <button onClick={() => {
                                setShipping(order.id)
                                setShipForm({
                                  trackingNumber: order.trackingNumber || '',
                                  trackingUrl: order.trackingUrl || '',
                                  expectedDelivery: '',
                                  fulfillmentCost: order.fulfillmentCost != null ? String(order.fulfillmentCost) : '',
                                })
                              }}
                                className="text-[10px] text-primary hover:underline">
                                Edit
                              </button>
                              <button
                                onClick={() => handleResendNotification(order.id)}
                                disabled={resending === order.id}
                                className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5 disabled:opacity-50">
                                {resending === order.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Bell className="h-2.5 w-2.5" />}
                                Resend
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : (
        /* ─── All Gifts Tab ─── */
        loadingAll ? (
          <div className="text-muted text-sm">Loading all gifts...</div>
        ) : allOrders.length === 0 ? (
          <p className="text-muted text-sm">No gifts yet.</p>
        ) : (
          <div className="bg-surface rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th label="Item" sortKey="itemName" active={allSort.sortKey === 'itemName'} dir={allSort.sortDir} onClick={allSort.toggle} />
                  <Th label="From" sortKey="senderName" active={allSort.sortKey === 'senderName'} dir={allSort.sortDir} onClick={allSort.toggle} />
                  <Th label="To" sortKey="recipientName" active={allSort.sortKey === 'recipientName'} dir={allSort.sortDir} onClick={allSort.toggle} />
                  <Th label="Amount" sortKey="amount" active={allSort.sortKey === 'amount'} dir={allSort.sortDir} onClick={allSort.toggle} />
                  <Th label="Method" sortKey="redemptionMethod" active={allSort.sortKey === 'redemptionMethod'} dir={allSort.sortDir} onClick={allSort.toggle} />
                  <Th label="Status" sortKey="status" active={allSort.sortKey === 'status'} dir={allSort.sortDir} onClick={allSort.toggle} />
                  <Th label="Created" sortKey="createdAt" active={allSort.sortKey === 'createdAt'} dir={allSort.sortDir} onClick={allSort.toggle} />
                  <th className="p-3 text-left text-xs text-muted font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {sortBy(allOrders, allSort.sortKey, allSort.sortDir).map(order => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {order.itemImage && <img src={order.itemImage} alt="" className="w-8 h-8 rounded object-cover" />}
                        <div>
                          <p className="font-medium text-xs">{order.itemName}</p>
                          {order.itemUrl && (
                            <a href={order.itemUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-[10px] flex items-center gap-0.5 hover:underline">
                              <ExternalLink className="h-2.5 w-2.5" /> Product
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{order.senderName || '—'}</td>
                    <td className="p-3 text-xs">
                      <p>{order.recipientName}</p>
                      <p className="text-muted text-[10px]">{order.recipientPhone}</p>
                    </td>
                    <td className="p-3 text-xs">
                      <p className="font-medium">${order.amount.toFixed(2)}</p>
                      {order.platformFee > 0 && <p className="text-[10px] text-green-500">+${order.platformFee.toFixed(2)} fee</p>}
                    </td>
                    <td className="p-3">
                      {order.redemptionMethod ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-surface border border-border">
                          {order.redemptionMethod}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <a href={`/gift/${order.redeemCode}`} target="_blank" rel="noopener noreferrer"
                        className="text-primary text-[10px] hover:underline flex items-center gap-0.5">
                        <ExternalLink className="h-2.5 w-2.5" /> Gift page
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

function PnLSection({ stats }: { stats: Stats }) {
  const pnlSort = useSort<string>('createdAt', 'desc')

  if (!stats.pnl || stats.pnl.details.length === 0) {
    return <p className="text-muted text-sm">No gift orders with financial data yet.</p>
  }

  const sortedDetails = sortBy(stats.pnl.details, pnlSort.sortKey, pnlSort.sortDir)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-green-500" />
        P&L / Margins
      </h2>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {(() => {
              const { details } = stats.pnl
              const totalPlatformFees = details.reduce((s, d) => s + d.platformFee, 0)
              const totalStripeFees = details.reduce((s, d) => s + d.stripeFee, 0)
              const totalFulfillment = details.reduce((s, d) => s + (d.fulfillmentCost || 0), 0)
              const totalNet = details.reduce((s, d) => s + d.netMargin, 0)
              const totalVolume = details.reduce((s, d) => s + d.totalCharged, 0)
              return (
                <>
                  <div className="bg-surface rounded-xl p-4 border border-border">
                    <p className="text-[10px] text-muted uppercase tracking-wider">Gift Volume</p>
                    <p className="text-xl font-bold text-foreground">${totalVolume.toFixed(2)}</p>
                    <p className="text-[10px] text-muted">{details.length} orders</p>
                  </div>
                  <div className="bg-surface rounded-xl p-4 border border-border">
                    <p className="text-[10px] text-muted uppercase tracking-wider">Platform Fees</p>
                    <p className="text-xl font-bold text-green-400">${totalPlatformFees.toFixed(2)}</p>
                    <p className="text-[10px] text-muted">Gross revenue</p>
                  </div>
                  <div className="bg-surface rounded-xl p-4 border border-border">
                    <p className="text-[10px] text-muted uppercase tracking-wider">Costs</p>
                    <p className="text-xl font-bold text-red-400">${(totalStripeFees + totalFulfillment).toFixed(2)}</p>
                    <p className="text-[10px] text-muted">Stripe: ${totalStripeFees.toFixed(2)} · Fulfillment: ${totalFulfillment.toFixed(2)}</p>
                  </div>
                  <div className="bg-surface rounded-xl p-4 border border-border">
                    <p className="text-[10px] text-muted uppercase tracking-wider">Net Margin</p>
                    <p className={`text-xl font-bold ${totalNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>${totalNet.toFixed(2)}</p>
                    <p className="text-[10px] text-muted">{totalPlatformFees > 0 ? ((totalNet / totalPlatformFees) * 100).toFixed(0) : 0}% of fees</p>
                  </div>
                </>
              )
            })()}
          </div>
          {/* Detail table */}
          <div className="bg-surface rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th label="Gift" sortKey="itemName" active={pnlSort.sortKey === 'itemName'} dir={pnlSort.sortDir} onClick={pnlSort.toggle} />
                  <Th label="Charged" sortKey="totalCharged" active={pnlSort.sortKey === 'totalCharged'} dir={pnlSort.sortDir} onClick={pnlSort.toggle} className="text-right" />
                  <Th label="Platform Fee" sortKey="platformFee" active={pnlSort.sortKey === 'platformFee'} dir={pnlSort.sortDir} onClick={pnlSort.toggle} className="text-right" />
                  <Th label="Stripe Fee" sortKey="stripeFee" active={pnlSort.sortKey === 'stripeFee'} dir={pnlSort.sortDir} onClick={pnlSort.toggle} className="text-right" />
                  <Th label="Fulfillment" sortKey="fulfillmentCost" active={pnlSort.sortKey === 'fulfillmentCost'} dir={pnlSort.sortDir} onClick={pnlSort.toggle} className="text-right" />
                  <Th label="Net" sortKey="netMargin" active={pnlSort.sortKey === 'netMargin'} dir={pnlSort.sortDir} onClick={pnlSort.toggle} className="text-right" />
                  <Th label="Status" sortKey="status" active={pnlSort.sortKey === 'status'} dir={pnlSort.sortDir} onClick={pnlSort.toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedDetails.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="p-3">
                      <p className="text-xs font-medium">{d.itemName}</p>
                      <p className="text-[10px] text-muted">{d.senderName} · {new Date(d.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="p-3 text-right text-xs">${d.totalCharged.toFixed(2)}</td>
                    <td className="p-3 text-right text-xs text-green-400">${d.platformFee.toFixed(2)}</td>
                    <td className="p-3 text-right text-xs text-red-300">-${d.stripeFee.toFixed(2)}</td>
                    <td className="p-3 text-right text-xs text-red-300">{d.fulfillmentCost != null ? `-$${d.fulfillmentCost.toFixed(2)}` : <span className="text-muted">—</span>}</td>
                    <td className={`p-3 text-right text-xs font-medium ${d.netMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>${d.netMargin.toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[d.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {STATUS_LABEL[d.status] || d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    </div>
  )
}

function AnalyticsSection({ stats }: { stats: Stats }) {
  const a = stats.analytics
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={BarChart3} label="Page Views" value={a.pageViews.total} sub={`+${a.pageViews.today} today · +${a.pageViews.week} this week`} />
        <KpiCard icon={Users} label="Sessions Today" value={a.pageViews.uniqueSessionsToday} sub={`${a.pageViews.uniqueSessionsWeek} this week`} />
        <KpiCard icon={Globe} label="Product Links" value={stats.productClicks.totalLinks} sub={`${stats.productClicks.totalClicks} total clicks`} />
        <KpiCard icon={Users} label="Users" value={stats.users.total} sub={`+${stats.users.newToday} today`} />
        <KpiCard icon={Link2} label="Top Clicked" value={stats.productClicks.topClicked?.[0]?.clicks || 0} sub={stats.productClicks.topClicked?.[0]?.productName || '—'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="bg-surface rounded-xl border border-border">
          <h3 className="text-sm font-medium p-4 border-b border-border flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Top Pages
          </h3>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {a.topPages.map(p => (
              <div key={p.path} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted truncate max-w-[70%]">{p.path}</span>
                <span className="font-medium">{p.views}</span>
              </div>
            ))}
            {a.topPages.length === 0 && <p className="p-4 text-sm text-muted text-center">No page views yet.</p>}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="bg-surface rounded-xl border border-border">
          <h3 className="text-sm font-medium p-4 border-b border-border flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Top Referrers
          </h3>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {a.topReferrers.map(r => (
              <div key={r.referrer} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted truncate max-w-[70%]">{r.referrer}</span>
                <span className="font-medium">{r.views}</span>
              </div>
            ))}
            {a.topReferrers.length === 0 && <p className="p-4 text-sm text-muted text-center">No referrer data yet.</p>}
          </div>
        </div>

        {/* UTM Sources */}
        <div className="bg-surface rounded-xl border border-border">
          <h3 className="text-sm font-medium p-4 border-b border-border flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> UTM Sources
          </h3>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {a.topUtmSources.map(u => (
              <div key={u.source} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted">{u.source}</span>
                <span className="font-medium">{u.views}</span>
              </div>
            ))}
            {a.topUtmSources.length === 0 && <p className="p-4 text-sm text-muted text-center">No UTM data yet.</p>}
          </div>
        </div>

        {/* UTM Campaigns */}
        <div className="bg-surface rounded-xl border border-border">
          <h3 className="text-sm font-medium p-4 border-b border-border flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> UTM Campaigns
          </h3>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {a.topUtmCampaigns.map(c => (
              <div key={c.campaign} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted">{c.campaign}</span>
                <span className="font-medium">{c.views}</span>
              </div>
            ))}
            {a.topUtmCampaigns.length === 0 && <p className="p-4 text-sm text-muted text-center">No campaign data yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductLinksSection({ stats }: { stats: Stats }) {
  const links = stats.analytics.allProductClicks
  const linkSort = useSort<string>('clicks', 'desc')
  const sortedLinks = sortBy(links, linkSort.sortKey, linkSort.sortDir)
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Link2} label="Total Links" value={links.length} />
        <KpiCard icon={BarChart3} label="Total Clicks" value={links.reduce((s, l) => s + l.clicks, 0)} />
        <KpiCard icon={Globe} label="With Clicks" value={links.filter(l => l.clicks > 0).length} sub={`${links.filter(l => l.clicks === 0).length} never clicked`} />
        <KpiCard icon={Zap} label="Sources" value={[...new Set(links.map(l => l.source))].join(', ') || '—'} />
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th label="Product" sortKey="productName" active={linkSort.sortKey === 'productName'} dir={linkSort.sortDir} onClick={linkSort.toggle} />
              <Th label="Source" sortKey="source" active={linkSort.sortKey === 'source'} dir={linkSort.sortDir} onClick={linkSort.toggle} />
              <Th label="Price" sortKey="priceValue" active={linkSort.sortKey === 'priceValue'} dir={linkSort.sortDir} onClick={linkSort.toggle} className="text-right" />
              <Th label="Clicks" sortKey="clicks" active={linkSort.sortKey === 'clicks'} dir={linkSort.sortDir} onClick={linkSort.toggle} className="text-right" />
              <Th label="Last Referrer" sortKey="lastReferrer" active={linkSort.sortKey === 'lastReferrer'} dir={linkSort.sortDir} onClick={linkSort.toggle} />
              <Th label="Last Clicked" sortKey="lastClicked" active={linkSort.sortKey === 'lastClicked'} dir={linkSort.sortDir} onClick={linkSort.toggle} />
              <Th label="Created" sortKey="createdAt" active={linkSort.sortKey === 'createdAt'} dir={linkSort.sortDir} onClick={linkSort.toggle} />
              <th className="p-3 text-left text-xs text-muted font-medium">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedLinks.map(link => (
              <tr key={link.id} className="hover:bg-background/50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {link.image && (
                      <img src={link.image} alt="" className="w-8 h-8 rounded object-cover" />
                    )}
                    <span className="truncate max-w-[200px]">{link.productName}</span>
                  </div>
                </td>
                <td className="p-3"><SourceBadge source={link.source} /></td>
                <td className="p-3 text-right">{link.price || '—'}</td>
                <td className="p-3 text-right font-medium">{link.clicks}</td>
                <td className="p-3 text-xs text-muted truncate max-w-[150px]">{link.lastReferrer || '—'}</td>
                <td className="p-3 text-xs text-muted">{link.lastClicked ? new Date(link.lastClicked).toLocaleDateString() : '—'}</td>
                <td className="p-3 text-xs text-muted">{new Date(link.createdAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <a href={link.targetUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted">No product links yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [adminTab, setAdminTab] = useState<'dashboard' | 'fulfillment' | 'pnl' | 'analytics' | 'product-links'>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  // Sort states for dashboard tables
  const giftSendsSort = useSort<string>('createdAt', 'desc')
  const usersSort = useSort<string>('updatedAt', 'desc')
  const itemsSort = useSort<string>('addedAt', 'desc')
  const reengSort = useSort<string>('createdAt', 'desc')

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      {/* Top-level tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit">
        <button
          onClick={() => setAdminTab('dashboard')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            adminTab === 'dashboard' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Dashboard
        </button>
        <button
          onClick={() => setAdminTab('fulfillment')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            adminTab === 'fulfillment' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          Fulfillment
        </button>
        <button
          onClick={() => setAdminTab('pnl')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            adminTab === 'pnl' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" />
          P&L
        </button>
        <button
          onClick={() => setAdminTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            adminTab === 'analytics' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Analytics
        </button>
        <button
          onClick={() => setAdminTab('product-links')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            adminTab === 'product-links' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
          Product Links
        </button>
      </div>

      {adminTab === 'fulfillment' ? (
        <GiftFulfillmentSection />
      ) : adminTab === 'pnl' ? (
        loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : stats ? (
          <PnLSection stats={stats} />
        ) : (
          <p className="text-muted">Failed to load stats.</p>
        )
      ) : adminTab === 'analytics' ? (
        loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : stats ? (
          <AnalyticsSection stats={stats} />
        ) : (
          <p className="text-muted">Failed to load stats.</p>
        )
      ) : adminTab === 'product-links' ? (
        loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : stats ? (
          <ProductLinksSection stats={stats} />
        ) : (
          <p className="text-muted">Failed to load stats.</p>
        )
      ) : (
      /* Dashboard tab */
      loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : !stats ? (
        <p className="text-muted">Failed to load stats.</p>
      ) : (
      <>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Total Users" value={stats.users.total} sub={`+${stats.users.newToday} today · +${stats.users.newWeek} this week`}>
          <Breakdown items={[
            { label: 'Phone', value: stats.users.withPhone },
            { label: 'Email', value: stats.users.withEmail },
            { label: 'Both linked', value: stats.users.withBoth },
            { label: 'Active', value: stats.users.active },
            { label: 'Gold', value: stats.users.gold, color: 'text-yellow-500' },
          ]} />
        </KpiCard>

        <KpiCard icon={Package} label="Items Added Today" value={stats.items.today} sub={`${stats.items.total} total · +${stats.items.week} this week · Avg per user: ${stats.items.avgPerUser}`}>
          <SourceBar breakdown={stats.items.sourceBreakdown} total={stats.items.today} />
          {Object.keys(stats.items.sourceBreakdownWeek).length > 0 && (
            <>
              <div className="text-[10px] text-muted uppercase tracking-wider mt-2 mb-1">This week</div>
              <Breakdown items={Object.entries(stats.items.sourceBreakdownWeek).map(([k, v]) => ({ label: k, value: v }))} />
            </>
          )}
        </KpiCard>

        <KpiCard icon={MessageCircle} label="WA Messages Today" value={stats.whatsapp.today} sub={`${stats.whatsapp.total} total · +${stats.whatsapp.week} this week`}>
          <Breakdown items={[
            { label: 'Inbound', value: stats.whatsapp.today - stats.whatsapp.outboundToday },
            { label: 'Outbound', value: stats.whatsapp.outboundToday },
            { label: 'Unique phones', value: stats.whatsapp.uniquePhonesToday },
          ]} />
          <div className="text-[10px] text-muted uppercase tracking-wider mt-2 mb-1">By status</div>
          <Breakdown items={[
            ...Object.entries(stats.whatsapp.statusBreakdown).map(([k, v]) => ({ label: k, value: v })),
            { label: 'Failed (all time)', value: stats.whatsapp.failed, color: 'text-red-400' },
          ]} />
          {Object.keys(stats.whatsapp.typeBreakdown).length > 0 && (
            <>
              <div className="text-[10px] text-muted uppercase tracking-wider mt-2 mb-1">By type</div>
              <Breakdown items={Object.entries(stats.whatsapp.typeBreakdown).map(([k, v]) => ({ label: k, value: v }))} />
            </>
          )}
        </KpiCard>

        <KpiCard icon={AlertTriangle} label="Errors Today" value={stats.errors.today} sub={`This week: ${stats.errors.week} · ${stats.recentErrors.length} recent`}>
          {Object.keys(stats.errors.bySourceToday).length > 0 && (
            <Breakdown items={Object.entries(stats.errors.bySourceToday).map(([k, v]) => ({ label: k, value: v }))} />
          )}
        </KpiCard>
      </div>

      {/* Engagement */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Engagement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Zap} label="Web Chat Messages" value={stats.engagement.totalChatMessages} sub={`+${stats.engagement.chatMessagesToday} today · +${stats.engagement.chatMessagesWeek} this week`}>
            {Object.keys(stats.engagement.chatByRole).length > 0 && (
              <Breakdown items={Object.entries(stats.engagement.chatByRole).map(([k, v]) => ({ label: k, value: v }))} />
            )}
            <Breakdown items={[
              { label: 'Unique users today', value: stats.engagement.uniqueChatUsersToday },
            ]} />
          </KpiCard>
          <KpiCard icon={Activity} label="Events Created" value={stats.engagement.totalEvents} sub={`+${stats.engagement.eventsToday} today · +${stats.engagement.eventsWeek} this week`} />
          <KpiCard icon={Users} label="Circle Members" value={stats.engagement.totalCircleMembers} sub={`+${stats.engagement.circleMembersToday} today · +${stats.engagement.circleMembersWeek} this week`} />
          <KpiCard icon={Globe} label="Items by Source (All)" value={stats.items.total}>
            <SourceBar breakdown={stats.items.sourceBreakdownAll} total={stats.items.total} />
          </KpiCard>
        </div>
      </div>

      {/* Group Monitoring */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Group Chat Monitoring</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Users} label="Active Groups" value={stats.groupMonitoring.activeGroups} sub={stats.groupMonitoring.totalGroups + ' total'} />
          <KpiCard icon={MessageCircle} label="Buffered Messages" value={stats.groupMonitoring.bufferedMessages} sub={'+' + stats.groupMonitoring.messagesToday + ' today'} />
          <KpiCard icon={Activity} label="Profiles Created" value={stats.groupMonitoring.profilesCreated} sub="from group chats" />
          <div className="bg-surface rounded-xl p-5 border border-border flex items-center justify-center">
            <a href="/admin/groups" className="text-sm text-primary font-medium hover:underline">View all groups &rarr;</a>
          </div>
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Revenue
          <span className="text-sm font-normal text-muted ml-2">
            Total earned: ${(stats.revenue.giftSendFees + stats.revenue.platformFees).toFixed(2)}
          </span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={DollarSign} label="Gift Send Fees" value={`$${stats.revenue.giftSendFees.toFixed(2)}`} sub={`${stats.revenue.giftSendCount} gifts sent`}>
            <Breakdown items={[
              { label: 'Today', value: `$${stats.revenue.giftSendFeesToday.toFixed(2)}`, color: 'text-green-500' },
              { label: 'Gifts today', value: stats.revenue.giftSendCountToday },
              { label: 'Avg fee/gift', value: stats.revenue.giftSendCount > 0 ? `$${(stats.revenue.giftSendFees / stats.revenue.giftSendCount).toFixed(2)}` : '$0.00' },
            ]} />
          </KpiCard>
          <KpiCard icon={DollarSign} label="Gift Volume (GMV)" value={`$${stats.revenue.giftSendVolume.toFixed(2)}`} sub="total charged to senders">
            <Breakdown items={[
              { label: 'Today', value: `$${stats.revenue.giftSendVolumeToday.toFixed(2)}` },
              ...(Object.keys(stats.revenue.giftSendByStatus).length > 0
                ? Object.entries(stats.revenue.giftSendByStatus).map(([k, v]) => ({
                    label: k,
                    value: v,
                    color: k === 'REDEEMED' ? 'text-green-500' : k === 'PAID' ? 'text-yellow-500' : undefined,
                  }))
                : []),
            ]} />
          </KpiCard>
          <KpiCard icon={DollarSign} label="Contribution Fees" value={`$${stats.revenue.platformFees.toFixed(2)}`}>
            <Breakdown items={[
              { label: 'Today', value: `$${stats.revenue.platformFeesToday.toFixed(2)}` },
              { label: 'Contributions', value: `${stats.revenue.contributionCount} ($${stats.revenue.contributions.toFixed(2)})` },
            ]} />
          </KpiCard>
          <KpiCard icon={Crown} label="Subscriptions" value={stats.revenue.activeSubscriptions} sub="Gold members">
            <Breakdown items={[
              { label: 'MRR (est)', value: `$${(stats.revenue.activeSubscriptions * 4.99).toFixed(2)}`, color: 'text-yellow-500' },
            ]} />
          </KpiCard>
        </div>

        {/* Recent Gift Sends */}
        {stats.revenue.recentGiftSends.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-muted mb-2">Recent Gift Sends</h3>
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <Th label="From" sortKey="sender.name" active={giftSendsSort.sortKey === 'sender.name'} dir={giftSendsSort.sortDir} onClick={giftSendsSort.toggle} />
                    <Th label="To" sortKey="recipientName" active={giftSendsSort.sortKey === 'recipientName'} dir={giftSendsSort.sortDir} onClick={giftSendsSort.toggle} />
                    <Th label="Item" sortKey="itemName" active={giftSendsSort.sortKey === 'itemName'} dir={giftSendsSort.sortDir} onClick={giftSendsSort.toggle} />
                    <Th label="Amount" sortKey="totalCharged" active={giftSendsSort.sortKey === 'totalCharged'} dir={giftSendsSort.sortDir} onClick={giftSendsSort.toggle} />
                    <Th label="Fee" sortKey="platformFee" active={giftSendsSort.sortKey === 'platformFee'} dir={giftSendsSort.sortDir} onClick={giftSendsSort.toggle} />
                    <Th label="Status" sortKey="status" active={giftSendsSort.sortKey === 'status'} dir={giftSendsSort.sortDir} onClick={giftSendsSort.toggle} />
                    <Th label="Date" sortKey="createdAt" active={giftSendsSort.sortKey === 'createdAt'} dir={giftSendsSort.sortDir} onClick={giftSendsSort.toggle} />
                  </tr>
                </thead>
                <tbody>
                  {sortBy(stats.revenue.recentGiftSends, giftSendsSort.sortKey, giftSendsSort.sortDir).map((g) => (
                    <tr key={g.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="p-3">{g.sender.name || '—'}</td>
                      <td className="p-3">{g.recipientName || '—'}</td>
                      <td className="p-3 max-w-[200px] truncate">{g.itemName}</td>
                      <td className="p-3">${g.totalCharged.toFixed(2)}</td>
                      <td className="p-3 text-green-500">${g.platformFee.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          g.status === 'REDEEMED' ? 'bg-green-500/20 text-green-500' :
                          g.status === 'PAID' || g.status === 'NOTIFIED' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>{g.status}</span>
                      </td>
                      <td className="p-3 text-muted text-xs">{new Date(g.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Costs by Provider */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          API Costs
          <span className="text-sm font-normal text-muted ml-2">
            Total: ${stats.costsTotalAll.toFixed(4)} · Today: ${stats.costsTotalToday.toFixed(4)}
          </span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.costs).map(([provider, data]) => (
            <CostCard key={provider} provider={provider} data={data} />
          ))}
          {Object.keys(stats.costs).length === 0 && (
            <p className="text-sm text-muted col-span-4">No API calls logged yet.</p>
          )}
        </div>
      </div>

      {/* Recent Users */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recently Active Users</h2>
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Name" sortKey="name" active={usersSort.sortKey === 'name'} dir={usersSort.sortDir} onClick={usersSort.toggle} />
                <Th label="Phone" sortKey="phone" active={usersSort.sortKey === 'phone'} dir={usersSort.sortDir} onClick={usersSort.toggle} />
                <Th label="Email" sortKey="email" active={usersSort.sortKey === 'email'} dir={usersSort.sortDir} onClick={usersSort.toggle} />
                <Th label="Items" sortKey="_count.items" active={usersSort.sortKey === '_count.items'} dir={usersSort.sortDir} onClick={usersSort.toggle} />
                <Th label="Msgs Used" sortKey="_count.chatMessages" active={usersSort.sortKey === '_count.chatMessages'} dir={usersSort.sortDir} onClick={usersSort.toggle} />
                <Th label="Last Active" sortKey="updatedAt" active={usersSort.sortKey === 'updatedAt'} dir={usersSort.sortDir} onClick={usersSort.toggle} />
                <Th label="Joined" sortKey="createdAt" active={usersSort.sortKey === 'createdAt'} dir={usersSort.sortDir} onClick={usersSort.toggle} />
              </tr>
            </thead>
            <tbody>
              {sortBy(stats.recentUsers, usersSort.sortKey, usersSort.sortDir).map((u) => {
                const msgsUsed = u._count.chatMessages
                const atLimit = msgsUsed >= 10 && u.messageCredits === 0
                const nearLimit = msgsUsed >= 7 && msgsUsed < 10
                return (
                <tr key={u.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="p-3">{u.name || '—'}</td>
                  <td className="p-3 text-muted">{u.phone || '—'}</td>
                  <td className="p-3 text-muted">{u.email || '—'}</td>
                  <td className="p-3">{u._count.items}</td>
                  <td className="p-3">
                    <span className={atLimit ? 'text-red-500 font-semibold' : nearLimit ? 'text-amber-500 font-medium' : ''}>
                      {msgsUsed}/10
                    </span>
                    {u.messageCredits > 0 && <span className="text-xs text-muted ml-1">+{u.messageCredits}cr</span>}
                  </td>
                  <td className="p-3 text-muted">{new Date(u.updatedAt).toLocaleDateString()}</td>
                  <td className="p-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Added Today */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Items Added Today</h2>
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Source" sortKey="source" active={itemsSort.sortKey === 'source'} dir={itemsSort.sortDir} onClick={itemsSort.toggle} />
                <Th label="Item" sortKey="name" active={itemsSort.sortKey === 'name'} dir={itemsSort.sortDir} onClick={itemsSort.toggle} />
                <Th label="User" sortKey="user.name" active={itemsSort.sortKey === 'user.name'} dir={itemsSort.sortDir} onClick={itemsSort.toggle} />
                <Th label="Price" sortKey="priceValue" active={itemsSort.sortKey === 'priceValue'} dir={itemsSort.sortDir} onClick={itemsSort.toggle} />
                <Th label="Time" sortKey="addedAt" active={itemsSort.sortKey === 'addedAt'} dir={itemsSort.sortDir} onClick={itemsSort.toggle} />
              </tr>
            </thead>
            <tbody>
              {stats.itemsAddedToday.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-muted text-center">No items added today.</td></tr>
              ) : sortBy(stats.itemsAddedToday, itemsSort.sortKey, itemsSort.sortDir).map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="p-3"><SourceBadge source={item.source} /></td>
                  <td className="p-3 max-w-xs truncate">{item.name}</td>
                  <td className="p-3 text-muted">{item.user.name || '—'}</td>
                  <td className="p-3">{item.price || '—'}</td>
                  <td className="p-3 text-muted">{new Date(item.addedAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <div className="bg-surface rounded-xl border border-border divide-y divide-border/50">
          {stats.recentActivity.map((a) => (
            <div key={a.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-muted" />
                <div>
                  <span className="font-medium">{a.user.name || 'Unknown'}</span>
                  <span className="text-muted ml-2">{a.type.replace(/_/g, ' ').toLowerCase()}</span>
                  {a.item && <span className="text-primary ml-1">{a.item.name}</span>}
                </div>
              </div>
              <span className="text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {stats.recentActivity.length === 0 && (
            <p className="p-3 text-sm text-muted text-center">No recent activity.</p>
          )}
        </div>
      </div>

      {/* User Feedback */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          User Feedback
          <span className="text-sm font-normal text-muted ml-2">
            {stats.feedback.positive + stats.feedback.negative} total
            {stats.feedback.positive > 0 && <span className="text-green-500 ml-2">+{stats.feedback.positive}</span>}
            {stats.feedback.negative > 0 && <span className="text-red-400 ml-2">-{stats.feedback.negative}</span>}
          </span>
        </h2>
        <div className="bg-surface rounded-xl border border-border divide-y divide-border/50">
          {stats.feedback.recent.map((f) => (
            <div key={f.id} className="p-3 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className={`mt-0.5 text-lg ${f.rating === 'positive' ? '' : ''}`}>
                  {f.rating === 'positive' ? '👍' : '👎'}
                </span>
                <div className="min-w-0">
                  <span className="font-medium text-sm">{f.user.name || f.user.phone || 'Unknown'}</span>
                  <span className="text-xs text-muted ml-2">{f.source}</span>
                  {f.comment && <p className="text-sm text-muted mt-0.5">{f.comment}</p>}
                </div>
              </div>
              <span className="text-xs text-muted whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {stats.feedback.recent.length === 0 && (
            <p className="p-3 text-sm text-muted text-center">No feedback collected yet.</p>
          )}
        </div>
      </div>

      {/* Re-engagement */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          <Send className="inline h-5 w-5 mr-2 text-primary" />
          Re-engagement
          <span className="text-sm font-normal text-muted ml-2">
            {stats.reengagement.smsSent + stats.reengagement.whatsappSent + stats.reengagement.emailSent} sent · {stats.reengagement.activated} activated · {stats.reengagement.eligible} eligible
          </span>
        </h2>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-surface rounded-xl p-4 border border-border text-center">
            <p className="text-2xl font-bold text-green-500">{stats.reengagement.smsSent}</p>
            <p className="text-xs text-muted mt-1">SMS Sent</p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-border text-center">
            <p className="text-2xl font-bold text-green-400">{stats.reengagement.whatsappSent}</p>
            <p className="text-xs text-muted mt-1">WhatsApp Sent</p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-border text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.reengagement.emailSent}</p>
            <p className="text-xs text-muted mt-1">Email Sent</p>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-border text-center">
            <p className="text-2xl font-bold text-primary">{stats.reengagement.activated}</p>
            <p className="text-xs text-muted mt-1">Activated (have items)</p>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="User" sortKey="name" active={reengSort.sortKey === 'name'} dir={reengSort.sortDir} onClick={reengSort.toggle} />
                <Th label="Contact" sortKey="phone" active={reengSort.sortKey === 'phone'} dir={reengSort.sortDir} onClick={reengSort.toggle} />
                <Th label="Items" sortKey="items" active={reengSort.sortKey === 'items'} dir={reengSort.sortDir} onClick={reengSort.toggle} />
                <Th label="Status" sortKey="status" active={reengSort.sortKey === 'status'} dir={reengSort.sortDir} onClick={reengSort.toggle} />
                <Th label="Channel" sortKey="channel" active={reengSort.sortKey === 'channel'} dir={reengSort.sortDir} onClick={reengSort.toggle} />
                <Th label="Sent At" sortKey="sentAt" active={reengSort.sortKey === 'sentAt'} dir={reengSort.sortDir} onClick={reengSort.toggle} />
                <Th label="Signed Up" sortKey="createdAt" active={reengSort.sortKey === 'createdAt'} dir={reengSort.sortDir} onClick={reengSort.toggle} />
              </tr>
            </thead>
            <tbody>
              {stats.reengagement.users.length === 0 ? (
                <tr><td colSpan={7} className="p-3 text-muted text-center">No re-engagement data.</td></tr>
              ) : sortBy(stats.reengagement.users, reengSort.sortKey, reengSort.sortDir).map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="p-3 font-medium">{u.name || '—'}</td>
                  <td className="p-3 text-muted text-xs">
                    {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span>}
                    {u.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>}
                  </td>
                  <td className="p-3">{u.items}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      u.status === 'sent' ? 'bg-green-500/20 text-green-600' :
                      u.status === 'eligible' ? 'bg-yellow-500/20 text-yellow-600' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {u.channel ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        u.channel === 'sms' ? 'bg-blue-500/20 text-blue-600' :
                        u.channel === 'whatsapp' ? 'bg-green-500/20 text-green-600' :
                        'bg-purple-500/20 text-purple-600'
                      }`}>
                        {u.channel}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-muted text-xs">{u.sentAt ? new Date(u.sentAt).toLocaleString() : '—'}</td>
                  <td className="p-3 text-muted text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Errors */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Errors</h2>
        <div className="bg-surface rounded-xl border border-border divide-y divide-border/50">
          {stats.recentErrors.map((e) => (
            <div key={e.id} className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/20 text-red-400">{e.source}</span>
                <span className="text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted truncate">{e.message}</p>
            </div>
          ))}
          {stats.recentErrors.length === 0 && (
            <p className="p-3 text-sm text-muted text-center">No errors recorded.</p>
          )}
        </div>
      </div>
      </>
      ))}
    </div>
  )
}
