'use client'

import { useEffect, useState } from 'react'
import { Users, Package, MessageCircle, DollarSign, AlertTriangle, Activity, Crown, Globe, Phone, Mail, Zap, Send, Truck, ExternalLink, Loader2, Gift } from 'lucide-react'

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
  recentUsers: Array<{ id: string; name: string | null; phone: string | null; email: string | null; createdAt: string; _count: { items: number } }>
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

interface GiftOrder {
  id: string; itemName: string; itemUrl: string | null; itemImage: string | null
  amount: number; platformFee: number; totalCharged: number; status: string
  redemptionMethod: string | null; senderName: string | null; recipientName: string
  recipientPhone: string; recipientEmail: string | null
  shippingName: string | null; shippingAddress: string | null
  shippingCity: string | null; shippingState: string | null; shippingZip: string | null
  trackingNumber: string | null; trackingUrl: string | null
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
  const [shipForm, setShipForm] = useState<{ trackingNumber: string; trackingUrl: string; expectedDelivery: string }>({ trackingNumber: '', trackingUrl: '', expectedDelivery: '' })

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
      }),
    })
    if (res.ok) {
      setShipOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'SHIPPED', shippedAt: new Date().toISOString() } : o))
      setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'SHIPPED', shippedAt: new Date().toISOString() } : o))
      setShipping(null)
      setShipForm({ trackingNumber: '', trackingUrl: '', expectedDelivery: '' })
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
                    <th className="p-3 text-left text-xs text-muted font-medium">Item</th>
                    <th className="p-3 text-left text-xs text-muted font-medium">Ship to</th>
                    <th className="p-3 text-left text-xs text-muted font-medium">Amount</th>
                    <th className="p-3 text-left text-xs text-muted font-medium">Status</th>
                    <th className="p-3 text-left text-xs text-muted font-medium">Redeemed</th>
                    <th className="p-3 text-left text-xs text-muted font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pendingShip, ...shipped].map(order => (
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
                        {order.status === 'REDEEMED_PENDING_SHIPMENT' ? (
                          shipping === order.id ? (
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
                              <div className="flex gap-1">
                                <button onClick={() => handleShip(order.id)}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                                  <Truck className="h-3 w-3" /> Ship
                                </button>
                                <button onClick={() => setShipping(null)}
                                  className="px-2 py-1.5 bg-surface border border-border rounded-lg text-xs text-muted hover:text-foreground">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setShipping(order.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                              <Truck className="h-3 w-3" /> Mark shipped
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-muted">
                            {order.shippedAt && `Shipped ${new Date(order.shippedAt).toLocaleDateString()}`}
                            {order.trackingUrl && (
                              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline mt-0.5">Track</a>
                            )}
                          </span>
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
                  <th className="p-3 text-left text-xs text-muted font-medium">Item</th>
                  <th className="p-3 text-left text-xs text-muted font-medium">From</th>
                  <th className="p-3 text-left text-xs text-muted font-medium">To</th>
                  <th className="p-3 text-left text-xs text-muted font-medium">Amount</th>
                  <th className="p-3 text-left text-xs text-muted font-medium">Method</th>
                  <th className="p-3 text-left text-xs text-muted font-medium">Status</th>
                  <th className="p-3 text-left text-xs text-muted font-medium">Created</th>
                  <th className="p-3 text-left text-xs text-muted font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {allOrders.map(order => (
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

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
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Gift Fulfillment — always renders independently */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          Gift Fulfillment
        </h2>
        <GiftFulfillmentSection />
      </div>

      {loading ? (
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
                  <tr className="border-b border-border text-muted">
                    <th className="text-left p-3 font-medium">From</th>
                    <th className="text-left p-3 font-medium">To</th>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-left p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Fee</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.revenue.recentGiftSends.map((g) => (
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
        <h2 className="text-lg font-semibold mb-3">Recent Signups</h2>
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Phone</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Items</th>
                <th className="text-left p-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="p-3">{u.name || '—'}</td>
                  <td className="p-3 text-muted">{u.phone || '—'}</td>
                  <td className="p-3 text-muted">{u.email || '—'}</td>
                  <td className="p-3">{u._count.items}</td>
                  <td className="p-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
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
              <tr className="border-b border-border text-muted">
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Item</th>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Price</th>
                <th className="text-left p-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.itemsAddedToday.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-muted text-center">No items added today.</td></tr>
              ) : stats.itemsAddedToday.map((item) => (
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
              <tr className="border-b border-border text-muted">
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Contact</th>
                <th className="text-left p-3 font-medium">Items</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Channel</th>
                <th className="text-left p-3 font-medium">Sent At</th>
                <th className="text-left p-3 font-medium">Signed Up</th>
              </tr>
            </thead>
            <tbody>
              {stats.reengagement.users.length === 0 ? (
                <tr><td colSpan={7} className="p-3 text-muted text-center">No re-engagement data.</td></tr>
              ) : stats.reengagement.users.map((u) => (
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
      )}
    </div>
  )
}
