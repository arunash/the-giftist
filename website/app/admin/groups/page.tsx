'use client'

import { useEffect, useState } from 'react'
import { Users, MessageSquare, Brain, Radio, ChevronDown, ChevronRight } from 'lucide-react'

interface GroupStats {
  totalGroups: number
  activeGroups: number
  totalBufferedMessages: number
  messagesToday: number
  messagesWeek: number
  totalExtractions: number
  profilesFromGroups: number
}

interface GroupChat {
  id: string
  userId: string
  groupId: string
  groupName: string | null
  isActive: boolean
  lastExtractedAt: string | null
  messageCount: number
  createdAt: string
  userName: string
  totalMessages: number
  uniqueSenders: number
}

interface GroupMessage {
  id: string
  groupId: string
  senderPhone: string
  senderName: string | null
  content: string
  createdAt: string
  userId: string
}

export default function AdminGroupsPage() {
  const [stats, setStats] = useState<GroupStats | null>(null)
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [recentMessages, setRecentMessages] = useState<GroupMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<string | null>(null)
  const [showMessages, setShowMessages] = useState(false)

  useEffect(() => {
    fetch('/api/admin/groups')
      .then(r => r.json())
      .then(data => {
        setStats(data.stats)
        setGroups(data.groups)
        setRecentMessages(data.recentMessages)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const triggerExtraction = async () => {
    setExtracting(true)
    setExtractResult(null)
    try {
      const res = await fetch('/api/cron/group-extraction', {
        headers: { Authorization: 'Bearer ' + (prompt('Enter CRON_SECRET:') || '') },
      })
      const data = await res.json()
      setExtractResult(data.result || JSON.stringify(data))
    } catch (e) {
      setExtractResult('Error: ' + String(e))
    } finally {
      setExtracting(false)
    }
  }

  const timeAgo = (date: string) => {
    const ms = Date.now() - new Date(date).getTime()
    const hours = Math.floor(ms / (1000 * 60 * 60))
    if (hours < 1) return 'just now'
    if (hours < 24) return hours + 'h ago'
    const days = Math.floor(hours / 24)
    return days + 'd ago'
  }

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Group Chat Monitoring</h1>
        <button
          onClick={triggerExtraction}
          disabled={extracting}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition disabled:opacity-50"
        >
          {extracting ? 'Extracting...' : 'Run Extraction Now'}
        </button>
      </div>

      {extractResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          {extractResult}
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Groups"
            value={stats.activeGroups}
            sub={stats.totalGroups + ' total'}
          />
          <KpiCard
            icon={<MessageSquare className="h-4 w-4" />}
            label="Buffered Messages"
            value={stats.totalBufferedMessages}
            sub={stats.messagesToday + ' today / ' + stats.messagesWeek + ' this week'}
          />
          <KpiCard
            icon={<Brain className="h-4 w-4" />}
            label="Extractions Run"
            value={stats.totalExtractions}
            sub={stats.profilesFromGroups + ' profiles created'}
          />
          <KpiCard
            icon={<Radio className="h-4 w-4" />}
            label="Profiles from Groups"
            value={stats.profilesFromGroups}
            sub="via GROUP_CHAT source"
          />
        </div>
      )}

      {/* Groups Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Monitored Groups ({groups.length})</h2>
        </div>
        {groups.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No groups being monitored yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Group ID</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Owner</th>
                  <th className="px-4 py-2 font-medium">Messages</th>
                  <th className="px-4 py-2 font-medium">Pending</th>
                  <th className="px-4 py-2 font-medium">Senders</th>
                  <th className="px-4 py-2 font-medium">Last Extracted</th>
                  <th className="px-4 py-2 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-b border-border hover:bg-surface-hover">
                    <td className="px-4 py-2">
                      <span className={'px-2 py-0.5 rounded text-xs font-medium ' +
                        (g.isActive ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-400')}>
                        {g.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted" title={g.groupId}>
                      {g.groupId.length > 20 ? g.groupId.slice(0, 20) + '...' : g.groupId}
                    </td>
                    <td className="px-4 py-2">{g.groupName || '—'}</td>
                    <td className="px-4 py-2">{g.userName}</td>
                    <td className="px-4 py-2">{g.totalMessages}</td>
                    <td className="px-4 py-2">
                      <span className={g.messageCount >= 30 ? 'text-primary font-medium' : ''}>
                        {g.messageCount}
                      </span>
                    </td>
                    <td className="px-4 py-2">{g.uniqueSenders}</td>
                    <td className="px-4 py-2 text-muted">
                      {g.lastExtractedAt ? timeAgo(g.lastExtractedAt) : 'Never'}
                    </td>
                    <td className="px-4 py-2 text-muted">{timeAgo(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Messages (Collapsible) */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowMessages(!showMessages)}
          className="w-full px-4 py-3 border-b border-border flex items-center gap-2 hover:bg-surface-hover transition"
        >
          {showMessages ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <h2 className="font-semibold text-sm">Recent Buffered Messages ({recentMessages.length})</h2>
        </button>
        {showMessages && (
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {recentMessages.map(msg => (
              <div key={msg.id} className="px-4 py-2 text-sm">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-gray-900">
                    {msg.senderName || msg.senderPhone}
                  </span>
                  <span className="text-xs text-muted font-mono">
                    {msg.groupId.length > 16 ? msg.groupId.slice(0, 16) + '...' : msg.groupId}
                  </span>
                  <span className="text-xs text-muted ml-auto">{timeAgo(msg.createdAt)}</span>
                </div>
                <p className="text-gray-600 line-clamp-2">{msg.content}</p>
              </div>
            ))}
            {recentMessages.length === 0 && (
              <div className="p-8 text-center text-muted text-sm">No buffered messages yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-muted mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-muted mt-0.5">{sub}</p>
    </div>
  )
}
