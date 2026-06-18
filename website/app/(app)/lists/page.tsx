'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ListPlus, Loader2, Plus, Gift } from 'lucide-react'

interface ListSummary {
  id: string
  name: string
  description: string | null
  itemCount: number
  coverImages: string[]
}

export default function ListsPage() {
  const [lists, setLists] = useState<ListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchLists = () => {
    fetch('/api/lists')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLists(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(fetchLists, [])

  const handleCreate = async () => {
    const name = window.prompt('Name your new list')
    if (!name?.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) fetchLists()
    } catch {}
    finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 lg:px-10 lg:py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Lists</h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-hover transition disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New List
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      ) : lists.length === 0 ? (
        <div className="ig-card p-10 text-center">
          <ListPlus className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 mb-1">No lists yet</h3>
          <p className="text-sm text-gray-400 mb-4">
            Create a list to group gift ideas for a person, an occasion, or a theme.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition"
          >
            <Plus className="h-4 w-4" />
            Create List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="ig-card overflow-hidden hover:shadow-md transition"
            >
              <div className="grid grid-cols-2 gap-0.5 aspect-[2/1] bg-gray-50">
                {list.coverImages.length > 0 ? (
                  list.coverImages.slice(0, 4).map((img, i) => (
                    <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                  ))
                ) : (
                  <div className="col-span-2 flex items-center justify-center text-gray-300">
                    <Gift className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{list.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
