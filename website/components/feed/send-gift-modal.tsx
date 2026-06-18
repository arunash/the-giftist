'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Users, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { SendGiftCard } from '@/components/chat/send-gift-card'

interface CircleMember {
  id: string
  name: string | null
  phone: string
  relationship: string | null
}

interface SendGiftModalProps {
  item: {
    id: string
    name: string
    priceValue: number | null
    url: string
    image: string | null
  }
  onClose: () => void
}

export function SendGiftModal({ item, onClose }: SendGiftModalProps) {
  const [members, setMembers] = useState<CircleMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CircleMember | null>(null)

  useEffect(() => {
    fetch('/api/circle')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMembers(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Send as a gift</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Item summary */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {item.image && (
            <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
            {item.priceValue != null && (
              <p className="text-xs text-gray-500">${item.priceValue.toFixed(2)}</p>
            )}
          </div>
        </div>

        <div className="p-4">
          {selected ? (
            <div>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-gray-500 hover:text-gray-700 mb-2"
              >
                ← Pick someone else
              </button>
              <SendGiftCard
                data={{
                  recipientName: selected.name || 'your friend',
                  recipientPhone: selected.phone,
                  itemName: item.name,
                  itemPrice: item.priceValue || 0,
                  itemUrl: item.url,
                  itemImage: item.image || undefined,
                }}
              />
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">No one in your circle yet</p>
              <p className="text-xs text-gray-400 mb-4">
                Add the person you want to send a gift to first.
              </p>
              <Link
                href="/circle"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-hover transition"
              >
                Add to circle
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-2">Who is this for?</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 text-primary text-sm font-semibold">
                        {(m.name || m.phone).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {m.name || m.phone}
                        </p>
                        {m.relationship && (
                          <p className="text-xs text-gray-400 capitalize">{m.relationship}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
