'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

export default function EventOwnerActions({
  eventId,
  eventName,
}: {
  eventId: string
  eventName: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete "${eventName}"? This cannot be undone.`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/events')
      } else {
        alert('Failed to delete event')
      }
    } catch {
      alert('Failed to delete event')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-4">
      <Link
        href={`/events/new?edit=${eventId}`}
        className="inline-flex items-center gap-2 px-4 py-2 bg-surface-hover rounded-lg text-sm font-medium text-gray-900 hover:bg-border transition"
      >
        <Pencil className="h-4 w-4" />
        Edit Event
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {deleting ? 'Deleting...' : 'Delete Event'}
      </button>
    </div>
  )
}
