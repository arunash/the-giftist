'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Gift, Check, Trash2 } from 'lucide-react'

const eventTypes = [
  { value: 'BIRTHDAY', label: 'Birthday', emoji: '🎂' },
  { value: 'ANNIVERSARY', label: 'Anniversary', emoji: '💕' },
  { value: 'WEDDING', label: 'Wedding', emoji: '💒' },
  { value: 'BABY_SHOWER', label: 'Baby Shower', emoji: '👶' },
  { value: 'CHRISTMAS', label: 'Christmas', emoji: '🎄' },
  { value: 'HOLIDAY', label: 'Holiday', emoji: '🎉' },
  { value: 'OTHER', label: 'Other', emoji: '🎁' },
]

export default function EventFormPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditing = !!editId

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetchingEvent, setFetchingEvent] = useState(isEditing)
  const [items, setItems] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: '',
    type: 'BIRTHDAY',
    date: '',
    description: '',
    itemIds: [] as string[],
  })

  // Fetch user's items
  useEffect(() => {
    fetch('/api/items')
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [])

  // Fetch event data when editing
  useEffect(() => {
    if (!editId) return
    setFetchingEvent(true)
    fetch(`/api/events/${editId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Event not found')
        return res.json()
      })
      .then((event) => {
        setFormData({
          name: event.name || '',
          type: event.type || 'BIRTHDAY',
          date: event.date ? new Date(event.date).toISOString().split('T')[0] : '',
          description: event.description || '',
          itemIds: event.items?.map((ei: any) => ei.item?.id || ei.itemId) || [],
        })
        setFetchingEvent(false)
      })
      .catch((err) => {
        console.error(err)
        alert('Could not load event for editing')
        router.push('/events')
      })
  }, [editId, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEditing ? `/api/events/${editId}` : '/api/events'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const event = await res.json()
        router.push(`/events/${event.id}`)
      } else {
        alert(`Failed to ${isEditing ? 'update' : 'create'} event`)
      }
    } catch (error) {
      console.error(error)
      alert(`Failed to ${isEditing ? 'update' : 'create'} event`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${editId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/events')
      } else {
        alert('Failed to delete event')
      }
    } catch (error) {
      console.error(error)
      alert('Failed to delete event')
    } finally {
      setDeleting(false)
    }
  }

  const toggleItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      itemIds: prev.itemIds.includes(itemId)
        ? prev.itemIds.filter((id) => id !== itemId)
        : [...prev.itemIds, itemId],
    }))
  }

  if (fetchingEvent) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="animate-pulse text-muted text-center py-12">Loading event...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface rounded-xl border border-border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {isEditing ? 'Edit Event' : 'Create Event'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-3">Event Type</label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {eventTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: type.value }))}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition ${
                      formData.type === type.value
                        ? 'border-primary bg-primary-light'
                        : 'border-border hover:border-border-light'
                    }`}
                  >
                    <span className="text-2xl mb-1">{type.emoji}</span>
                    <span className="text-xs text-muted">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Name */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Event Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Sarah's 30th Birthday"
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                required
              />
            </div>

            {/* Event Date */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add any notes about the event..."
                rows={3}
                className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none"
              />
            </div>

            {/* Select Items */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-3">Add Items to This Event</label>
              {items.length === 0 ? (
                <div className="text-center py-8 bg-surface-hover rounded-lg">
                  <Gift className="h-12 w-12 text-[#333] mx-auto mb-2" />
                  <p className="text-muted">No items in your Giftist yet.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition ${
                        formData.itemIds.includes(item.id)
                          ? 'border-primary bg-primary-light'
                          : 'border-border hover:border-border-light'
                      }`}
                    >
                      <div className="w-12 h-12 bg-surface-hover rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Gift className="h-6 w-6 text-[#333]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm line-clamp-1">{item.name}</p>
                        <p className="text-primary text-sm">{item.price}</p>
                      </div>
                      {formData.itemIds.includes(item.id) && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted mt-2">
                {formData.itemIds.length} item{formData.itemIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !formData.name || !formData.date}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
            >
              {loading
                ? isEditing ? 'Saving...' : 'Creating...'
                : isEditing ? 'Save Changes' : 'Create Event'}
            </button>

            {/* Delete button (edit mode only) */}
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-red-500 border border-red-500/30 hover:bg-red-500/10 transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
