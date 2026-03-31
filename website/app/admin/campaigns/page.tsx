'use client'

import { useEffect, useState } from 'react'
import { Mail, MessageCircle, Clock, CheckCircle, XCircle, TrendingUp, Users, Send, Filter } from 'lucide-react'

interface CampaignData {
  stats: { queued: number; sent: number; skipped: number }
  weeklyVolume: number
  campaigns: Array<{ template: string; count: number }>
  engagement: Array<{ template: string; totalSent: number; engagedUsers: number; engagementRate: number }>
  messages: Array<{
    id: string
    userName: string
    userPhone: string
    subject: string
    template: string
    priority: number
    status: string
    scheduledAt: string
    sentAt: string | null
    expiresAt: string | null
    createdAt: string
    textPreview: string
  }>
}

const TEMPLATE_LABELS: Record<string, string> = {
  day3_suggestion: 'Day 3 — Gift Suggestion',
  day7_suggestion: 'Day 7 — Momentum Builder',
  day14_reactivation: 'Day 14 — Reactivation',
  gold_daily: 'Gold Daily',
  event_countdown: 'Event Countdown',
  circle_event_reminder: 'Circle Reminder',
  post_event_thankyou: 'Post-Event Thank You',
  post_event_feedback: 'Post-Event Feedback',
  seasonal_reminder: 'Holiday Reminder',
  churned_30_day: '30-Day Re-engagement',
  churned_60_day: '60-Day Re-engagement',
  welcome_message: 'Welcome',
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'bg-amber-100 text-amber-700',
  SENT: 'bg-green-100 text-green-700',
  SKIPPED: 'bg-gray-100 text-gray-500',
}

export default function CampaignsPage() {
  const [data, setData] = useState<CampaignData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterTemplate, setFilterTemplate] = useState<string>('all')

  useEffect(() => {
    fetch('/api/admin/campaigns')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse text-gray-400">Loading campaigns...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-red-500">Failed to load campaign data</p>
      </div>
    )
  }

  const filteredMessages = filterTemplate === 'all'
    ? data.messages
    : data.messages.filter(m => m.template === filterTemplate)

  const uniqueTemplates = [...new Set(data.messages.map(m => m.template))]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Send className="h-5 w-5 text-green-500" />} label="Sent (all time)" value={data.stats.sent} />
        <StatCard icon={<Clock className="h-5 w-5 text-amber-500" />} label="Queued" value={data.stats.queued} />
        <StatCard icon={<XCircle className="h-5 w-5 text-gray-400" />} label="Skipped" value={data.stats.skipped} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-blue-500" />} label="Sent this week" value={data.weeklyVolume} />
      </div>

      {/* Engagement by Campaign */}
      {data.engagement.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Campaign Engagement (30 days)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Campaign</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Sent</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Engaged</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.engagement.map(e => (
                  <tr key={e.template} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {TEMPLATE_LABELS[e.template] || e.template}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{e.totalSent}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{e.engagedUsers}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.engagementRate >= 30 ? 'bg-green-100 text-green-700' :
                        e.engagementRate >= 15 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {e.engagementRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaign Volume Breakdown */}
      {data.campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Volume by Campaign (30 days)</h2>
          </div>
          <div className="p-5 space-y-3">
            {data.campaigns.map(c => {
              const maxCount = Math.max(...data.campaigns.map(x => x.count))
              const width = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0
              return (
                <div key={c.template}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{TEMPLATE_LABELS[c.template] || c.template}</span>
                    <span className="text-gray-500 font-medium">{c.count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Messages */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Messages</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterTemplate}
              onChange={e => setFilterTemplate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 outline-none"
            >
              <option value="all">All campaigns</option>
              {uniqueTemplates.map(t => (
                <option key={t} value={t}>{TEMPLATE_LABELS[t] || t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Campaign</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Preview</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{m.userName}</div>
                    <div className="text-xs text-gray-400">{m.userPhone}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {TEMPLATE_LABELS[m.template] || m.template}
                    </span>
                    {m.priority >= 7 && (
                      <span className="ml-1 text-xs text-red-500 font-medium">P{m.priority}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 max-w-xs">
                    <p className="text-gray-600 truncate">{m.textPreview}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] || 'bg-gray-100 text-gray-500'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {m.sentAt
                      ? new Date(m.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : m.scheduledAt
                        ? `Sched: ${new Date(m.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                        : '-'
                    }
                    {m.expiresAt && (
                      <div className="text-amber-500">
                        Exp: {new Date(m.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredMessages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    No messages found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  )
}
