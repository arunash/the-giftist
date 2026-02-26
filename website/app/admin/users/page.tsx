'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

interface User {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  image: string | null
  createdAt: string
  lastActiveAt: string | null
  lastActiveSource: 'web' | 'whatsapp' | null
  _count: { items: number; contributions: number; chatMessages: number }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchUsers = (p: number, s: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '20' })
    if (s) params.set('search', s)
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users)
        setTotal(data.total)
        setPages(data.pages)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers(page, search)
  }, [page])

  const handleSearch = () => {
    setPage(1)
    fetchUsers(1, search)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users ({total})</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-gray-900 placeholder:text-muted focus:outline-none focus:border-primary w-72"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Phone</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Items</th>
              <th className="text-left p-3 font-medium">Contributions</th>
              <th className="text-left p-3 font-medium">Messages</th>
              <th className="text-left p-3 font-medium">Last Active</th>
              <th className="text-left p-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} onClick={() => router.push(`/admin/users/${u.id}`)} className="border-b border-border/50 hover:bg-surface-hover cursor-pointer">
                <td className="p-3 font-medium">{u.name || '—'}</td>
                <td className="p-3 text-muted">{u.phone || '—'}</td>
                <td className="p-3 text-muted">{u.email || '—'}</td>
                <td className="p-3">{u._count.items}</td>
                <td className="p-3">{u._count.contributions}</td>
                <td className="p-3">{u._count.chatMessages}</td>
                <td className="p-3">
                  {u.lastActiveAt ? (
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${u.lastActiveSource === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500'}`} title={u.lastActiveSource === 'whatsapp' ? 'WhatsApp' : 'Web'} />
                      <span className="text-muted">{timeAgo(u.lastActiveAt)}</span>
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="p-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
