'use client'

import { useState } from 'react'
import { Link2, Plus, Loader2, X } from 'lucide-react'

interface AddProductBarProps {
  onAdded: () => void
}

export function AddProductBar({ onAdded }: AddProductBarProps) {
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed || loading) return

    // Basic URL validation
    try {
      new URL(trimmed)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/items/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, source: 'MANUAL' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add item')
      }

      setUrl('')
      setExpanded(false)
      onAdded()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-surface rounded-xl border border-dashed border-border-light text-sm text-muted hover:border-primary hover:text-primary transition-all w-full"
      >
        <Plus className="h-4 w-4" />
        Add by URL
      </button>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted flex-shrink-0" />
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') {
              setExpanded(false)
              setUrl('')
              setError('')
            }
          }}
          placeholder="Paste any URL..."
          className="flex-1 text-sm text-white placeholder-muted outline-none bg-transparent"
          autoFocus
          disabled={loading}
        />
        <div className="flex items-center gap-1">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <>
              <button
                onClick={handleSubmit}
                disabled={!url.trim()}
                className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-hover transition disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setExpanded(false)
                  setUrl('')
                  setError('')
                }}
                className="p-1.5 text-muted hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
