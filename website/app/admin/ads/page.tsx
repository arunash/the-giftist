'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Eye, MousePointer, MessageCircle, TrendingUp, Pause, RefreshCw, Plus, Loader2 } from 'lucide-react'

interface MetaCampaign {
  id: string
  metaCampaignId: string
  name: string
  status: string
  dailyBudget: number
  spend: number
  impressions: number
  clicks: number
  messages: number
  cpc: number
  ctr: number
  cpm: number
  holidaySlug: string | null
  adText: string | null
  headline: string | null
  startDate: string
  endDate: string | null
  lastSyncAt: string
  createdAt: string
}

interface AdsData {
  campaigns: MetaCampaign[]
  totals: {
    totalSpend: number
    totalImpressions: number
    totalClicks: number
    totalMessages: number
    activeCampaigns: number
    avgCpc: number
    avgCtr: number
  }
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
  ERROR: 'bg-red-100 text-red-700',
}

export default function AdsPage() {
  const [data, setData] = useState<AdsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    dailyBudget: '5',
    adText: '',
    headline: '',
    holidaySlug: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  })

  const fetchData = async (sync = false) => {
    if (sync) setSyncing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/admin/ads${sync ? '?sync=1' : ''}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSync = () => fetchData(true)

  const handlePause = async (id: string) => {
    await fetch('/api/admin/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', campaignId: id }),
    })
    fetchData()
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: form.name,
          dailyBudget: parseFloat(form.dailyBudget),
          adText: form.adText,
          headline: form.headline,
          holidaySlug: form.holidaySlug || null,
          startDate: form.startDate,
          endDate: form.endDate || null,
        }),
      })
      const json = await res.json()
      if (json.error) {
        alert(json.error)
      } else {
        setShowCreate(false)
        setForm({ name: '', dailyBudget: '5', adText: '', headline: '', holidaySlug: '', startDate: new Date().toISOString().split('T')[0], endDate: '' })
        fetchData()
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleGenerateCopy = async (holiday: string) => {
    const res = await fetch('/api/admin/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_copy', holidayName: holiday }),
    })
    const copy = await res.json()
    setForm((f) => ({ ...f, adText: copy.text, headline: copy.headline, name: `${holiday} — WhatsApp`, holidaySlug: holiday.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-6 w-6 text-gray-400" /></div>
  }

  const t = data?.totals

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Meta Ads</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Meta'}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <KpiCard icon={TrendingUp} label="Active" value={String(t?.activeCampaigns || 0)} />
        <KpiCard icon={DollarSign} label="Total Spend" value={`$${(t?.totalSpend || 0).toFixed(2)}`} />
        <KpiCard icon={Eye} label="Impressions" value={(t?.totalImpressions || 0).toLocaleString()} />
        <KpiCard icon={MousePointer} label="Clicks" value={(t?.totalClicks || 0).toLocaleString()} />
        <KpiCard icon={MessageCircle} label="Messages" value={(t?.totalMessages || 0).toLocaleString()} />
        <KpiCard icon={DollarSign} label="Avg CPC" value={`$${(t?.avgCpc || 0).toFixed(2)}`} />
        <KpiCard icon={TrendingUp} label="Avg CTR" value={`${(t?.avgCtr || 0).toFixed(2)}%`} />
      </div>

      {/* Create Campaign Form */}
      {showCreate && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Create Campaign</h2>

          <div className="mb-4">
            <label className="text-sm text-gray-500 mb-1 block">Quick: Generate holiday copy</label>
            <div className="flex flex-wrap gap-2">
              {["Mother's Day", "Father's Day", "Christmas", "Valentine's Day", "Birthday", "Graduation"].map((h) => (
                <button
                  key={h}
                  onClick={() => handleGenerateCopy(h)}
                  className="px-3 py-1 text-xs bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Campaign Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="Mother's Day — WhatsApp"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Daily Budget ($)</label>
              <input
                value={form.dailyBudget}
                onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                type="number"
                min="1"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm text-gray-500 mb-1 block">Ad Text</label>
            <textarea
              value={form.adText}
              onChange={(e) => setForm({ ...form, adText: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
              rows={3}
              placeholder="Stuck on what to get someone? Tell us who you're shopping for..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Headline</label>
              <input
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="Find the perfect gift"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Holiday Slug (optional)</label>
              <input
                value={form.holidaySlug}
                onChange={(e) => setForm({ ...form, holidaySlug: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="mothers-day"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Start Date</label>
              <input
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                type="date"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">End Date (optional)</label>
              <input
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                type="date"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !form.name || !form.adText || !form.headline}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 text-sm"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {creating ? 'Creating...' : 'Create & Launch Campaign'}
          </button>
        </div>
      )}

      {/* Campaign Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Budget</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spend</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impr.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Msgs</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(!data?.campaigns.length) && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No campaigns yet. Create one or sync from Meta.
                </td>
              </tr>
            )}
            {data?.campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium">{c.name}</div>
                  {c.holidaySlug && (
                    <div className="text-xs text-violet-600">{c.holidaySlug}</div>
                  )}
                  <div className="text-xs text-gray-400">
                    {new Date(c.startDate).toLocaleDateString()}
                    {c.endDate && ` — ${new Date(c.endDate).toLocaleDateString()}`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm">${c.dailyBudget.toFixed(2)}/d</td>
                <td className="px-4 py-3 text-right text-sm font-medium">${c.spend.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-sm">{c.impressions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm">{c.clicks.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-green-600">{c.messages}</td>
                <td className="px-4 py-3 text-right text-sm">${c.cpc.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-sm">{c.ctr.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right">
                  {c.status === 'ACTIVE' && (
                    <button
                      onClick={() => handlePause(c.id)}
                      className="text-amber-600 hover:text-amber-800"
                      title="Pause campaign"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.campaigns.length ? (
        <div className="mt-3 text-xs text-gray-400 text-right">
          Last synced: {data.campaigns[0]?.lastSyncAt ? new Date(data.campaigns[0].lastSyncAt).toLocaleString() : 'Never'}
        </div>
      ) : null}
    </div>
  )
}
