'use client'

import { useEffect, useState } from 'react'
import { Users, Package, MessageCircle, DollarSign, AlertTriangle, Activity } from 'lucide-react'

interface Stats {
  users: { total: number; newToday: number }
  items: { total: number; today: number; sourceBreakdown: Record<string, number> }
  whatsapp: { total: number; today: number; failed: number }
  revenue: { platformFees: number; contributions: number; activeSubscriptions: number }
  costs: Record<string, { total: number; today: number; count: number; countToday: number }>
  recentErrors: Array<{ id: string; source: string; message: string; createdAt: string }>
  recentUsers: Array<{ id: string; name: string | null; phone: string | null; email: string | null; createdAt: string; _count: { items: number } }>
  recentActivity: Array<{ id: string; type: string; createdAt: string; user: { name: string | null }; item: { name: string } | null; metadata: string | null }>
  itemsAddedToday: Array<{ id: string; name: string; source: string; price: string | null; priceValue: number | null; addedAt: string; user: { name: string | null } }>
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface rounded-xl p-5 border border-border">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-sm text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!stats) {
    return <p className="text-muted">Failed to load stats.</p>
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Total Users" value={stats.users.total} sub={`+${stats.users.newToday} today`} />
        <KpiCard icon={Package} label="Items Added Today" value={stats.items.today} sub={`${stats.items.total} total`} />
        <KpiCard icon={MessageCircle} label="WA Messages Today" value={stats.whatsapp.today} sub={`${stats.whatsapp.failed} failed total`} />
        <KpiCard icon={AlertTriangle} label="Recent Errors" value={stats.recentErrors.length} />
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Revenue</h2>
        <div className="grid grid-cols-3 gap-4">
          <KpiCard icon={DollarSign} label="Platform Fees" value={`$${stats.revenue.platformFees.toFixed(2)}`} />
          <KpiCard icon={DollarSign} label="Total Contributions" value={`$${stats.revenue.contributions.toFixed(2)}`} />
          <KpiCard icon={Users} label="Active Subscriptions" value={stats.revenue.activeSubscriptions} />
        </div>
      </div>

      {/* Costs by Provider */}
      <div>
        <h2 className="text-lg font-semibold mb-3">API Costs</h2>
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
    </div>
  )
}
