'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ItemCard } from '@/components/feed/item-card'
import { ArrowLeft, Loader2, Gift } from 'lucide-react'

interface ListDetail {
  id: string
  name: string
  description: string | null
  items: { item: any }[]
}

export default function ListDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [list, setList] = useState<ListDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/lists/${id}`)
      .then((r) => {
        if (!r.ok) {
          setNotFound(true)
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (data) setList(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleRemove = async (itemId: string) => {
    try {
      await fetch(`/api/lists/${id}/items?itemId=${itemId}`, { method: 'DELETE' })
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((li) => li.item?.id !== itemId) } : prev
      )
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  if (notFound || !list) {
    return (
      <div className="p-4 lg:px-10 lg:py-6">
        <p className="text-sm text-gray-500">List not found.</p>
        <Link href="/lists" className="text-primary text-sm font-medium mt-2 inline-block">
          ← Back to lists
        </Link>
      </div>
    )
  }

  const items = list.items.map((li) => li.item).filter(Boolean)

  return (
    <div className="p-4 lg:px-10 lg:py-6 max-w-5xl">
      <Link
        href="/lists"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Lists
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
      {list.description && <p className="text-sm text-gray-400 mt-1">{list.description}</p>}
      <p className="text-sm text-gray-400 mt-1 mb-6">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>

      {items.length === 0 ? (
        <div className="ig-card p-10 text-center">
          <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 mb-1">This list is empty</h3>
          <p className="text-sm text-gray-400">
            Use "Save to list" on any item in your feed to add it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onRemoveFromList={handleRemove} />
          ))}
        </div>
      )}
    </div>
  )
}
