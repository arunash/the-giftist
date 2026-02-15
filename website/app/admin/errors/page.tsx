'use client'

import { useEffect, useState } from 'react'

interface ErrorEntry {
  id: string
  source: string
  message: string
  stack: string | null
  metadata: string | null
  severity: string
  createdAt: string
}

const SOURCES = ['', 'API', 'CHAT', 'EXTRACT', 'STRIPE_WEBHOOK', 'WHATSAPP_WEBHOOK']

export default function AdminErrorsPage() {
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [source, setSource] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchErrors = (p: number, s: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '50' })
    if (s) params.set('source', s)
    fetch(`/api/admin/errors?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setErrors(data.errors)
        setTotal(data.total)
        setPages(data.pages)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchErrors(page, source)
  }, [page, source])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Errors ({total})</h1>
        <select
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1) }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s || 'All Sources'}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-border divide-y divide-border/50">
        {loading ? (
          <p className="p-8 text-center text-muted">Loading...</p>
        ) : errors.length === 0 ? (
          <p className="p-8 text-center text-muted">No errors found.</p>
        ) : errors.map((e) => (
          <div
            key={e.id}
            className="p-4 hover:bg-surface-hover cursor-pointer"
            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  e.severity === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>{e.severity}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">{e.source}</span>
              </div>
              <span className="text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm mt-1 truncate">{e.message}</p>
            {expanded === e.id && e.stack && (
              <pre className="mt-3 p-3 bg-background rounded-lg text-xs text-muted overflow-x-auto whitespace-pre-wrap">{e.stack}</pre>
            )}
            {expanded === e.id && e.metadata && (
              <pre className="mt-2 p-3 bg-background rounded-lg text-xs text-muted overflow-x-auto">{e.metadata}</pre>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-surface border border-border rounded text-sm disabled:opacity-50 hover:bg-surface-hover"
          >
            Previous
          </button>
          <span className="text-sm text-muted">Page {page} of {pages}</span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 bg-surface border border-border rounded text-sm disabled:opacity-50 hover:bg-surface-hover"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
