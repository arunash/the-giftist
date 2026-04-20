'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Check, X, MessageSquare, Search, Filter, RefreshCw } from 'lucide-react'

interface TastemakerGift {
  id: string
  name: string
  price: string | null
  priceValue: number | null
  url: string | null
  domain: string | null
  why: string | null
  recipientTypes: string[]
  occasions: string[]
  interests: string[]
  priceRange: string
  trustScore: number
  tasteScore: number
  intentScore: number
  conversionScore: number
  totalScore: number
  signalCount: number
  sources: Record<string, any>
  reviewStatus: string
  reviewComment: string | null
  reviewedAt: string | null
  lastScrapedAt: string
}

interface TastemakerData {
  gifts: TastemakerGift[]
  totals: {
    total: number
    pending: number
    approved: number
    rejected: number
    avgScore: number
    signalBreakdown: Record<string, number>
  }
}

export default function TastemakerPage() {
  const [data, setData] = useState<TastemakerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [search, setSearch] = useState('')
  const [commenting, setCommenting] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tastemaker?filter=${filter}&search=${encodeURIComponent(search)}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [filter, search])

  useEffect(() => { fetchData() }, [fetchData])

  const handleReview = async (id: string, status: 'approved' | 'rejected', reviewComment?: string) => {
    setSaving(id)
    await fetch('/api/admin/tastemaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'review', id, status, comment: reviewComment }),
    })
    setSaving(null)
    setCommenting(null)
    setComment('')
    fetchData()
  }

  const t = data?.totals

  const signalBar = (score: number, max: number = 5) => {
    const pct = Math.min(100, (score / max) * 100)
    return (
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
      </div>
    )
  }

  const sourceLabels = (sources: Record<string, any>) => {
    return Object.keys(sources).map(s => (
      <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{s}</span>
    ))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tastemaker Review</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve AI-scraped gift recommendations</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Products</div>
          <div className="text-2xl font-bold">{t?.total || 0}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 cursor-pointer" onClick={() => setFilter('pending')}>
          <div className="text-sm text-amber-700">Pending Review</div>
          <div className="text-2xl font-bold text-amber-700">{t?.pending || 0}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 cursor-pointer" onClick={() => setFilter('approved')}>
          <div className="text-sm text-green-700">Approved</div>
          <div className="text-2xl font-bold text-green-700">{t?.approved || 0}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer" onClick={() => setFilter('rejected')}>
          <div className="text-sm text-red-700">Rejected</div>
          <div className="text-2xl font-bold text-red-700">{t?.rejected || 0}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Avg Score</div>
          <div className="text-2xl font-bold">{(t?.avgScore || 0).toFixed(1)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products, sources, tags..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize ${filter === f ? 'bg-violet-100 text-violet-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-6 w-6 text-gray-400" /></div>
      ) : (
        <div className="space-y-3">
          {data?.gifts.map((g) => (
            <div key={g.id} className={`bg-white rounded-lg border p-4 ${g.reviewStatus === 'rejected' ? 'border-red-200 opacity-60' : g.reviewStatus === 'approved' ? 'border-green-200' : 'border-gray-200'}`}>
              <div className="flex items-start gap-4">
                {/* Score */}
                <div className="text-center flex-shrink-0 w-14">
                  <div className={`text-xl font-bold ${g.totalScore >= 3 ? 'text-green-600' : g.totalScore >= 1.5 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {g.totalScore.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-gray-400">{g.signalCount}/4 signals</div>
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{g.name}</h3>
                    {g.price && <span className="text-sm font-bold text-gray-700 flex-shrink-0">{g.price}</span>}
                    {g.affiliateReady && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Affiliate</span>}
                  </div>

                  {g.why && <p className="text-xs text-gray-500 mb-2">{g.why}</p>}

                  {/* Signal bars */}
                  <div className="grid grid-cols-4 gap-3 mb-2">
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Trust {g.trustScore.toFixed(1)}</div>
                      {signalBar(g.trustScore)}
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Taste {g.tasteScore.toFixed(1)}</div>
                      {signalBar(g.tasteScore)}
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Intent {g.intentScore.toFixed(1)}</div>
                      {signalBar(g.intentScore)}
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Conv. {g.conversionScore.toFixed(1)}</div>
                      {signalBar(g.conversionScore)}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {g.recipientTypes.map(t => <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{t}</span>)}
                    {g.occasions.map(t => <span key={t} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">{t}</span>)}
                    {g.interests.map(t => <span key={t} className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">{t}</span>)}
                  </div>

                  {/* Sources */}
                  <div className="flex flex-wrap gap-1">
                    {sourceLabels(g.sources)}
                    {g.domain && <span className="text-[10px] text-gray-400">via {g.domain}</span>}
                  </div>

                  {/* Review comment */}
                  {g.reviewComment && (
                    <div className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-600">
                      💬 {g.reviewComment}
                    </div>
                  )}

                  {/* Comment input */}
                  {commenting === g.id && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 text-sm border rounded px-3 py-1.5"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && comment) {
                            handleReview(g.id, 'rejected', comment)
                          }
                        }}
                      />
                      <button
                        onClick={() => handleReview(g.id, 'rejected', comment)}
                        className="text-sm bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200"
                      >
                        Reject with comment
                      </button>
                      <button
                        onClick={() => { setCommenting(null); setComment('') }}
                        className="text-sm text-gray-400 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {g.reviewStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => handleReview(g.id, 'approved')}
                        disabled={saving === g.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setCommenting(g.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                  {g.reviewStatus === 'approved' && (
                    <span className="text-xs text-green-600 font-medium">✅ Approved</span>
                  )}
                  {g.reviewStatus === 'rejected' && (
                    <button
                      onClick={() => handleReview(g.id, 'approved')}
                      className="text-xs text-gray-400 hover:text-green-600"
                    >
                      Undo reject
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {data?.gifts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No products found for this filter.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
