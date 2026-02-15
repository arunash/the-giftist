import { Sparkles } from 'lucide-react'

interface SuggestionCardProps {
  suggestion: {
    title: string
    description: string
    category: string
  }
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  return (
    <div className="bg-surface rounded-xl border-2 border-accent/30 p-4 hover:border-accent/60 transition">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent-light text-accent flex-shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-accent font-semibold uppercase tracking-wide mb-1">
            AI Suggestion
          </p>
          <h3 className="font-medium text-gray-900 text-sm">{suggestion.title}</h3>
          <p className="text-xs text-muted mt-1">{suggestion.description}</p>
        </div>
      </div>
    </div>
  )
}
