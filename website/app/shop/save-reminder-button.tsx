'use client'

// "Text me this gift" save-for-later UI. Tapped from the product modal,
// expands inline to a phone input + send button. Posts to /api/save-reminder
// which schedules a WhatsApp reminder for the matching occasion (Mother's
// Day if applicable, otherwise +7 days).

import { useState } from 'react'
import { Bell, Check, Loader2, MessageCircle } from 'lucide-react'

type Status = 'idle' | 'expanded' | 'submitting' | 'success' | 'error'

export function SaveReminderButton({
  slug,
  occasion,
}: {
  slug: string
  occasion?: string | null
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setStatus('submitting')
    try {
      const res = await fetch('/api/save-reminder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, slug, occasion: occasion || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save')
      }
      setStatus('success')
    } catch (e: any) {
      setStatus('expanded')
      setError(e.message || 'Something went wrong')
    }
  }

  if (status === 'success') {
    const isMD = occasion === 'mothers-day'
    return (
      <div className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold">
        <Check className="h-4 w-4" />
        <span>{isMD ? "Saved! I'll text you May 7." : "Saved! I'll text you next week."}</span>
      </div>
    )
  }

  if (status === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStatus('expanded')}
        className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-semibold text-gray-700 transition"
      >
        <Bell className="h-4 w-4" />
        Save & text me a reminder
      </button>
    )
  }

  return (
    <div className="space-y-2 w-full">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
        Where should we text you?
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          autoFocus
          disabled={status === 'submitting'}
          className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!phone.trim() || status === 'submitting'}
          className="px-4 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-semibold hover:bg-pink-600 transition disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
        >
          {status === 'submitting' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          Save
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <p className="text-[10px] text-gray-400 leading-relaxed">
        We&apos;ll send one WhatsApp reminder
        {occasion === 'mothers-day' ? ' on May 7 (3 days before Mother’s Day)' : ' next week'}.
        That’s it — no other messages.
      </p>
    </div>
  )
}
