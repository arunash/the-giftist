'use client'

import { useEffect, useState } from 'react'
import { DollarSign, MousePointerClick, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface EpcData {
  range: string
  targetCpc: number
  retailerClicks: number
  conversions: { total: number; attributed: number; unattributed: number }
  commission: { approvedUsd: number; pendingUsd: number; totalUsd: number }
  epc: { approvedUsd: number; allNonDeclinedUsd: number }
  decision: {
    targetCpcUsd: number
    marginPerClickUsd: number
    roas: number
    verdict: 'NO_DATA' | 'INSUFFICIENT_DATA' | 'PROFITABLE' | 'UNPROFITABLE'
    unfreezeSpend: boolean
  }
  byNetwork: Array<{ network: string; conversions: number; commissionUsd: number; approvedUsd: number; epcUsd: number }>
  byCampaign: Array<{ utmCampaign: string; conversions: number; commissionUsd: number }>
  recent: Array<{
    network: string; orderId: string; commission: number; saleAmount: number | null
    currency: string; status: string; slug: string | null; utmCampaign: string | null
    clickId: string | null; createdAt: string
  }>
}

const VERDICT: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  PROFITABLE: { label: 'PROFITABLE — safe to unfreeze spend', cls: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2 },
  UNPROFITABLE: { label: 'UNPROFITABLE — keep spend frozen', cls: 'bg-red-100 text-red-800 border-red-300', icon: TrendingDown },
  INSUFFICIENT_DATA: { label: 'NOT ENOUGH DATA — need ≥30 conversions to judge', cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: AlertTriangle },
  NO_DATA: { label: 'NO CONVERSIONS YET — postbacks not flowing', cls: 'bg-gray-100 text-gray-600 border-gray-300', icon: AlertTriangle },
}

export default function EpcPage() {
  const [data, setData] = useState<EpcData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('30d')
  const [cpc, setCpc] = useState('2.32')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/epc?range=${range}&cpc=${cpc || '2.32'}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range, cpc])

  const v = data ? VERDICT[data.decision.verdict] : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EPC — Affiliate Profitability</h1>
          <p className="text-sm text-muted">Real earnings per retailer click vs cost per click. The spend gate.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Cost/click $</label>
          <input
            value={cpc}
            onChange={e => setCpc(e.target.value)}
            className="w-20 px-2 py-1.5 rounded-md border border-border text-sm"
            inputMode="decimal"
          />
          {['24h', '7d', '30d', 'all'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${range === r ? 'bg-primary text-white' : 'bg-surface text-muted hover:bg-surface-hover'}`}
            >{r}</button>
          ))}
        </div>
      </div>

      {loading && <p className="text-muted">Loading…</p>}

      {data && !loading && (
        <>
          {/* Verdict banner */}
          {v && (
            <div className={`flex items-center gap-3 border rounded-lg px-4 py-3 mb-6 ${v.cls}`}>
              <v.icon className="h-5 w-5 shrink-0" />
              <span className="font-semibold">{v.label}</span>
            </div>
          )}

          {/* Headline cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat icon={DollarSign} label="EPC (approved)" value={`$${data.epc.approvedUsd.toFixed(3)}`}
              sub={`vs $${data.targetCpc.toFixed(2)} cost/click`}
              tone={data.epc.approvedUsd >= data.targetCpc ? 'good' : 'bad'} />
            <Stat icon={data.decision.marginPerClickUsd >= 0 ? TrendingUp : TrendingDown} label="Margin / click"
              value={`$${data.decision.marginPerClickUsd.toFixed(3)}`}
              sub={`ROAS ${data.decision.roas.toFixed(2)}×`}
              tone={data.decision.marginPerClickUsd >= 0 ? 'good' : 'bad'} />
            <Stat icon={MousePointerClick} label="Retailer clicks" value={data.retailerClicks.toLocaleString()}
              sub={`${data.conversions.total} conversions`} />
            <Stat icon={DollarSign} label="Commission" value={`$${data.commission.approvedUsd.toFixed(2)}`}
              sub={`+$${data.commission.pendingUsd.toFixed(2)} pending`} />
          </div>

          {/* Attribution health */}
          <div className="text-sm text-muted mb-8">
            Attribution: <strong className="text-gray-900">{data.conversions.attributed}</strong> conversions joined to a click via sub-id,{' '}
            <strong className="text-gray-900">{data.conversions.unattributed}</strong> unattributed (e.g. Amazon report imports).
          </div>

          {/* By network */}
          <Section title="By network">
            <Table head={['Network', 'Conversions', 'Commission', 'Approved', 'EPC']}>
              {data.byNetwork.length === 0 && <EmptyRow cols={5} />}
              {data.byNetwork.map(n => (
                <tr key={n.network} className="border-t border-border">
                  <td className="py-2 px-3 font-medium capitalize">{n.network}</td>
                  <td className="py-2 px-3">{n.conversions}</td>
                  <td className="py-2 px-3">${n.commissionUsd.toFixed(2)}</td>
                  <td className="py-2 px-3">${n.approvedUsd.toFixed(2)}</td>
                  <td className="py-2 px-3">${n.epcUsd.toFixed(3)}</td>
                </tr>
              ))}
            </Table>
          </Section>

          {/* By campaign */}
          <Section title="By campaign">
            <Table head={['Campaign', 'Conversions', 'Commission']}>
              {data.byCampaign.length === 0 && <EmptyRow cols={3} />}
              {data.byCampaign.map(c => (
                <tr key={c.utmCampaign} className="border-t border-border">
                  <td className="py-2 px-3 font-medium">{c.utmCampaign}</td>
                  <td className="py-2 px-3">{c.conversions}</td>
                  <td className="py-2 px-3">${c.commissionUsd.toFixed(2)}</td>
                </tr>
              ))}
            </Table>
          </Section>

          {/* Recent conversions */}
          <Section title="Recent conversions">
            <Table head={['When', 'Network', 'Order', 'Sale', 'Commission', 'Status', 'Slug', 'Attributed']}>
              {data.recent.length === 0 && <EmptyRow cols={8} />}
              {data.recent.map(r => (
                <tr key={`${r.network}-${r.orderId}`} className="border-t border-border">
                  <td className="py-2 px-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="py-2 px-3 capitalize">{r.network}</td>
                  <td className="py-2 px-3 font-mono text-xs">{r.orderId}</td>
                  <td className="py-2 px-3">{r.saleAmount != null ? `$${r.saleAmount.toFixed(2)}` : '—'}</td>
                  <td className="py-2 px-3">${r.commission.toFixed(2)} {r.currency}</td>
                  <td className="py-2 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{r.slug || '—'}</td>
                  <td className="py-2 px-3">{r.clickId ? '✓' : '—'}</td>
                </tr>
              ))}
            </Table>
          </Section>
        </>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted text-sm mb-1">
        <Icon className="h-4 w-4" />{label}
      </div>
      <div className={`text-2xl font-bold ${tone === 'good' ? 'text-green-600' : tone === 'bad' ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="bg-surface border border-border rounded-lg overflow-x-auto">{children}</div>
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted text-xs uppercase tracking-wide">
          {head.map(h => <th key={h} className="py-2 px-3 font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="py-6 px-3 text-center text-muted">No data yet.</td></tr>
}
