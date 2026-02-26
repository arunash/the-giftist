'use client'

import { useEffect, useState } from 'react'
import { Users, Package, MessageCircle, DollarSign, AlertTriangle, Activity, Crown, Globe, Phone, Mail, Zap } from 'lucide-react'

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

      {/* Revenue */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Revenue</h2>
        <div className="grid grid-cols-3 gap-4">
          <KpiCard icon={DollarSign} label="Platform Fees" value={`$${stats.revenue.platformFees.toFixed(2)}`}>
            <Breakdown items={[
              { label: 'Today', value: `$${stats.revenue.platformFeesToday.toFixed(2)}` },
            ]} />
          </KpiCard>
          <KpiCard icon={DollarSign} label="Total Contributions" value={`$${stats.revenue.contributions.toFixed(2)}`}>
            <Breakdown items={[
              { label: 'Today', value: `$${stats.revenue.contributionsToday.toFixed(2)}` },
              { label: 'Count', value: `${stats.revenue.contributionCount} (${stats.revenue.contributionCountToday} today)` },
              { label: 'Avg', value: `$${stats.revenue.avgContribution.toFixed(2)}` },
            ]} />
          </KpiCard>
          <KpiCard icon={Crown} label="Active Subscriptions" value={stats.revenue.activeSubscriptions} sub="Gold members">
            <Breakdown items={[
              { label: 'MRR (est)', value: `$${(stats.revenue.activeSubscriptions * 4.99).toFixed(2)}`, color: 'text-yellow-500' },
            ]} />
          </KpiCard>
        </div>
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
