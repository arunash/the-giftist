'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Check } from 'lucide-react'

const eventTypes = [
  { value: 'BIRTHDAY', label: 'Birthday', emoji: '🎂' },
  { value: 'ANNIVERSARY', label: 'Anniversary', emoji: '💕' },
  { value: 'WEDDING', label: 'Wedding', emoji: '💒' },
  { value: 'BABY_SHOWER', label: 'Baby Shower', emoji: '👶' },
  { value: 'CHRISTMAS', label: 'Christmas', emoji: '🎄' },
  { value: 'HOLIDAY', label: 'Holiday', emoji: '🎉' },
  { value: 'OTHER', label: 'Other', emoji: '🎁' },
]

export default function NewEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: '',
    type: 'BIRTHDAY',
    date: '',
    description: '',
    itemIds: [] as string[],
  })

  useEffect(() => {
    fetch('/api/items')
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const event = await res.json()
        router.push(`/events/${event.id}`)
      } else {
        alert('Failed to create event')
      }
    } catch (error) {
      console.error(error)
      alert('Failed to create event')
    } finally {
      setLoading(false)
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

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h1 className="text-2xl font-bold text-secondary mb-6">Create Event</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Event Type</label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {eventTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: type.value }))}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition ${
                      formData.type === type.value
                        ? 'border-primary bg-primary-light'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl mb-1">{type.emoji}</span>
                    <span className="text-xs text-gray-600">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Sarah's 30th Birthday"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                required
              />
            </div>

            {/* Event Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add any notes about the event..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none"
              />
            </div>

            {/* Select Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Add Items to This Event</label>
              {items.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Gift className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No items in your Giftist yet.</p>
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
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Gift className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-secondary text-sm line-clamp-1">{item.name}</p>
                        <p className="text-primary text-sm">{item.price}</p>
                      </div>
                      {formData.itemIds.includes(item.id) && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {formData.itemIds.length} item{formData.itemIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !formData.name || !formData.date}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
