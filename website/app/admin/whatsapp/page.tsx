'use client'

import { useEffect, useState } from 'react'

interface WhatsAppMsg {
  id: string
  waMessageId: string
  phone: string
  type: string
  content: string | null
  itemId: string | null
  status: string
  error: string | null
  createdAt: string
  processedAt: string | null
}

const STATUSES = ['', 'RECEIVED', 'PROCESSED', 'FAILED']

export default function AdminWhatsAppPage() {
  const [messages, setMessages] = useState<WhatsAppMsg[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [status, setStatus] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchMessages = (p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '50' })
    if (status) params.set('status', status)
    if (phone) params.set('phone', phone)
    fetch(`/api/admin/whatsapp?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages)
        setTotal(data.total)
        setPages(data.pages)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMessages(page)
  }, [page, status])

  const handlePhoneSearch = () => {
    setPage(1)
    fetchMessages(1)
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'PROCESSED': return 'bg-green-500/20 text-green-400'
      case 'FAILED': return 'bg-red-500/20 text-red-400'
      case 'RECEIVED': return 'bg-yellow-500/20 text-yellow-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">WhatsApp Messages ({total})</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by phone..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePhoneSearch()}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary w-48"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s || 'All Statuses'}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Phone</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Content</th>
              <th className="text-left p-3 font-medium">Error</th>
              <th className="text-left p-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted">Loading...</td></tr>
            ) : messages.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted">No messages found.</td></tr>
            ) : messages.map((m) => (
              <tr key={m.id} className="border-b border-border/50 hover:bg-surface-hover">
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(m.status)}`}>
                    {m.status}
                  </span>
                </td>
                <td className="p-3 text-muted font-mono text-xs">{m.phone}</td>
                <td className="p-3 text-muted">{m.type}</td>
                <td className="p-3 max-w-xs truncate">{m.content || '—'}</td>
                <td className="p-3 text-red-400 max-w-xs truncate">{m.error || '—'}</td>
                <td className="p-3 text-muted text-xs">{new Date(m.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
