'use client'

import { useEffect, useState } from 'react'
import { Send, Users, Check, Bell } from 'lucide-react'

interface CircleMember {
  id: string
  phone: string
  name: string | null
  relationship: string | null
}

interface EventNotifyCircleProps {
  eventId: string
  circleNotifiedAt: string | null
}

export default function EventNotifyCircle({ eventId, circleNotifiedAt }: EventNotifyCircleProps) {
  const [members, setMembers] = useState<CircleMember[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(!!circleNotifiedAt)
  const [sentAt, setSentAt] = useState(circleNotifiedAt)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/circle')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(data)
          setSelected(new Set(data.map((m: CircleMember) => m.phone)))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleMember = (phone: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(phone)) next.delete(phone)
      else next.add(phone)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === members.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(members.map((m) => m.phone)))
    }
  }

  const handleSend = async () => {
    if (selected.size === 0) return
    setSending(true)
    setError('')

    try {
      const res = await fetch(`/api/events/${eventId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: Array.from(selected) }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send notifications')
        return
      }

      const data = await res.json()
      setSent(true)
      setSentAt(data.notifiedAt)
    } catch {
      setError('Failed to send notifications')
    } finally {
      setSending(false)
    }
  }

  const formatPhone = (phone: string) => {
    if (phone.length === 11 && phone.startsWith('1')) {
      return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`
    }
    return `+${phone}`
  }

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-6 mt-6">
        <div className="animate-pulse h-20 bg-surface-hover rounded-lg" />
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-gray-900">Notify Your Circle</h3>
        </div>
        <p className="text-sm text-muted">
          No one in your Gift Circle yet.{' '}
          <a href="/circle" className="text-primary hover:underline">
            Add people to your Circle
          </a>{' '}
          to notify them about this event.
        </p>
      </div>
    )
  }

  // Already notified
  if (sent && sentAt) {
    return (
      <div className="bg-surface rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-full">
            <Check className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Circle Notified</h3>
            <p className="text-xs text-muted">
              Sent on {new Date(sentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Notify Your Circle</h3>
            <p className="text-xs text-muted">Send gift ideas via WhatsApp to selected people</p>
          </div>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-primary hover:underline"
        >
          {selected.size === members.length ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {members.map((member) => (
          <label
            key={member.id}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(member.phone)}
              onChange={() => toggleMember(member.phone)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {member.name || formatPhone(member.phone)}
              </p>
              {member.name && (
                <p className="text-xs text-muted">{formatPhone(member.phone)}</p>
              )}
            </div>
            {member.relationship && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                {member.relationship}
              </span>
            )}
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <button
        onClick={handleSend}
        disabled={sending || selected.size === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {sending
          ? 'Sending...'
          : `Send to ${selected.size} ${selected.size === 1 ? 'person' : 'people'}`}
      </button>
    </div>
  )
}
