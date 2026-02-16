'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, X, UserPlus } from 'lucide-react'

interface CircleMember {
  id: string
  phone: string
  name: string | null
  relationship: string | null
  source: string
  createdAt: string
}

const RELATIONSHIP_LABELS: Record<string, { label: string; color: string }> = {
  family: { label: 'Family', color: 'bg-purple-500/10 text-purple-600' },
  friend: { label: 'Friend', color: 'bg-blue-500/10 text-blue-600' },
  work: { label: 'Work', color: 'bg-amber-500/10 text-amber-600' },
  other: { label: 'Other', color: 'bg-gray-500/10 text-gray-500' },
}

export default function CirclePage() {
  const [members, setMembers] = useState<CircleMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchMembers = () => {
    fetch('/api/circle')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMembers(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim() || undefined,
          relationship: relationship || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to add member')
        return
      }

      setPhone('')
      setName('')
      setRelationship('')
      setShowForm(false)
      fetchMembers()
    } catch {
      setError('Failed to add member')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/circle/${id}`, { method: 'DELETE' })
      setMembers((prev) => prev.filter((m) => m.id !== id))
    } catch {}
  }

  const formatPhone = (phone: string) => {
    if (phone.length === 11 && phone.startsWith('1')) {
      return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`
    }
    return `+${phone}`
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gift Circle</h1>
            <p className="text-sm text-muted mt-1">
              People who get notified about your upcoming events
            </p>
          </div>
          {!showForm && members.length > 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition"
            >
              <Plus className="h-4 w-4" />
              Add Person
            </button>
          )}
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-surface rounded-xl border border-border p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Add to your circle</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full text-sm text-gray-900 placeholder-muted bg-surface border border-border rounded-lg px-3 py-2 outline-none focus:border-primary transition"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mom, Alex"
                    className="w-full text-sm text-gray-900 placeholder-muted bg-surface border border-border rounded-lg px-3 py-2 outline-none focus:border-primary transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full text-sm text-gray-900 bg-surface border border-border rounded-lg px-3 py-2 outline-none focus:border-primary transition"
                >
                  <option value="">Select...</option>
                  <option value="family">Family</option>
                  <option value="friend">Friend</option>
                  <option value="work">Work</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting || !phone.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {submitting ? 'Adding...' : 'Add to Circle'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError('') }}
                  className="px-4 py-2 text-sm text-muted hover:text-gray-900 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Members List */}
        {loading ? (
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-14 bg-surface-hover rounded-lg" />
              <div className="h-14 bg-surface-hover rounded-lg" />
              <div className="h-14 bg-surface-hover rounded-lg" />
            </div>
          </div>
        ) : members.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Start your Gift Circle</h2>
            <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
              Add family and friends so they can be notified via WhatsApp when you have upcoming events with gift ideas.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition"
            >
              <UserPlus className="h-4 w-4" />
              Add Your First Person
            </button>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border divide-y divide-border">
            {members.map((member) => {
              const rel = member.relationship ? RELATIONSHIP_LABELS[member.relationship] : null
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {(member.name || member.phone).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name || formatPhone(member.phone)}
                      </p>
                      {member.name && (
                        <p className="text-xs text-muted">{formatPhone(member.phone)}</p>
                      )}
                    </div>
                    {rel && (
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${rel.color}`}>
                        {rel.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="p-1.5 text-muted hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                    title="Remove from circle"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
