'use client'

interface SuggestionChipProps {
  label: string
  onClick: (label: string) => void
}

export function SuggestionChip({ label, onClick }: SuggestionChipProps) {
  return (
    <button
      onClick={() => onClick(label)}
      className="px-3 py-1.5 text-sm text-primary border border-primary/20 rounded-full hover:bg-primary/5 transition whitespace-nowrap"
    >
      {label}
    </button>
  )
}
