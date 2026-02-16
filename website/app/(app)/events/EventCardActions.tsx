'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

export default function EventCardActions({
  eventId,
  eventName,
}: {
  eventId: string
  eventName: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${eventName}"? This cannot be undone.`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
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
    <div className="absolute top-4 right-4 flex items-center gap-1" style={{ zIndex: 1 }}>
      <Link
        href={`/events/new?edit=${eventId}`}
        onClick={(e) => e.stopPropagation()}
        className="p-2 rounded-lg text-muted hover:text-gray-900 hover:bg-surface-hover transition"
        title="Edit event"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition disabled:opacity-50"
        title="Delete event"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
