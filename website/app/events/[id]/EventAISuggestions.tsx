'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'

interface EventAISuggestionsProps {
  eventName: string
  itemNames: string[]
}

export default function EventAISuggestions({ eventName, itemNames }: EventAISuggestionsProps) {
  const itemList = itemNames.length > 0
    ? itemNames.slice(0, 5).join(', ')
    : 'none yet'

  const query = `Suggest 3 more gift ideas for "${eventName}". Current items: ${itemList}.`

  return (
    <div className="mt-8 bg-primary/5 border border-primary/20 rounded-xl p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Need more gift ideas?</h3>
          <p className="text-sm text-muted mb-3">
            Your Gift Concierge can suggest items based on the person&apos;s taste and what&apos;s already on the list.
          </p>
          <Link
            href={`/chat?q=${encodeURIComponent(query)}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition"
          >
            <Sparkles className="h-4 w-4" />
            Get AI Suggestions
          </Link>
        </div>
      </div>
    </div>
  )
}
