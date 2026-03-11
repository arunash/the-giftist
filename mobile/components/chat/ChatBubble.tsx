import { View, Text } from 'react-native'
import { parseChatContent, type ChatSegment } from '@/lib/parse-chat-content'
import { ProductCard } from './ProductCard'

interface Props {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function ChatBubble({ role, content, isStreaming }: Props) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <View className="flex-row justify-end mb-3 px-4">
        <View className="bg-primary rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
          <Text className="text-sm text-white font-sans">{content}</Text>
        </View>
      </View>
    )
  }

  // Assistant messages: parse special blocks
  const segments = parseChatContent(content)

  return (
    <View className="flex-row justify-start mb-3 px-4">
      <View className="max-w-[90%]">
        {segments.map((segment, i) => {
          if (segment.type === 'text') {
            return (
              <View key={i} className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 mb-1">
                <Text className="text-sm text-foreground font-sans leading-relaxed">
                  {segment.content}
                </Text>
              </View>
            )
          }

          if (segment.type === 'product') {
            return <ProductCard key={i} product={segment.data} />
          }

          // Other block types rendered as text for now
          return null
        })}

        {isStreaming && (
          <View className="flex-row items-center mt-1 ml-2">
            <View className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1" />
            <View className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse mr-1" />
            <View className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse" />
          </View>
        )}
      </View>
    </View>
  )
}
