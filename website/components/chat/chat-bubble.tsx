import { cn } from '@/lib/utils'

interface ChatBubbleProps {
  role: 'USER' | 'ASSISTANT'
  content: string
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'USER'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
        )}
      >
        {content}
      </div>
    </div>
  )
}
