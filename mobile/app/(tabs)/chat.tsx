import { useRef, useEffect, useCallback } from 'react'
import { View, Text, FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { streamChat } from '@/lib/sse'
import { useChatStore } from '@/hooks/useChat'
import { useOfflineCache } from '@/hooks/useOfflineCache'
import { ChatBubble } from '@/components/chat/ChatBubble'
import { ChatInput } from '@/components/chat/ChatInput'
import { SuggestionChip } from '@/components/chat/SuggestionChip'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { haptic } from '@/lib/haptics'
import type { ChatMessage } from '@/lib/types'

const SUGGESTIONS = [
  "What should I get my mom for her birthday?",
  "I need a gift for a coworker under $50",
  "Show me trending gift ideas",
  "Help me plan a gift for my partner's anniversary",
]

export default function ChatScreen() {
  const {
    messages,
    isStreaming,
    streamingText,
    setMessages,
    addMessage,
    setStreaming,
    appendStreamText,
    resetStreamText,
    finalizeStream,
  } = useChatStore()

  const flatListRef = useRef<FlatList>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load chat history
  const historyQuery = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => apiGet<ChatMessage[]>('/api/chat/history'),
  })

  useOfflineCache(['chat-history'])

  useEffect(() => {
    if (historyQuery.data) {
      setMessages(historyQuery.data)
    }
  }, [historyQuery.data])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }, [])

  const handleSend = useCallback(
    async (text: string) => {
      // Add user message
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      }
      addMessage(userMsg)
      scrollToBottom()

      // Start streaming
      setStreaming(true)
      resetStreamText()

      haptic.light()

      abortRef.current = await streamChat(text, {
        onMessage: (chunk) => {
          appendStreamText(chunk)
          scrollToBottom()
        },
        onDone: () => {
          finalizeStream(`resp-${Date.now()}`)
          haptic.success()
          scrollToBottom()
        },
        onError: (err) => {
          setStreaming(false)
          haptic.error()
          // Add error message
          addMessage({
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: err.message || 'Something went wrong. Please try again.',
            createdAt: new Date().toISOString(),
          })
          scrollToBottom()
        },
      })
    },
    [addMessage, setStreaming, resetStreamText, appendStreamText, finalizeStream, scrollToBottom]
  )

  const handleSuggestion = (text: string) => {
    handleSend(text)
  }

  // Build display data: messages + streaming text
  const displayData = [
    ...messages,
    ...(isStreaming && streamingText
      ? [
          {
            id: 'streaming',
            role: 'assistant' as const,
            content: streamingText,
            createdAt: new Date().toISOString(),
          },
        ]
      : []),
  ]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-border">
        <Text className="text-xl font-sans-bold text-foreground">Gift Concierge</Text>
        <Text className="text-xs text-muted">Powered by AI</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={88}
      >
        <FlatList
          ref={flatListRef}
          data={displayData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble
              role={item.role}
              content={item.content}
              isStreaming={item.id === 'streaming'}
            />
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          ListEmptyComponent={
            historyQuery.isLoading ? (
              <LoadingSpinner fullScreen />
            ) : (
              <View className="flex-1 items-center justify-center px-6 pt-16">
                <Text className="text-lg font-sans-semibold text-foreground mb-2 text-center">
                  What can I help you find?
                </Text>
                <Text className="text-sm text-muted mb-6 text-center">
                  I'm your personal gift concierge. Ask me anything about gifts, events, or your wishlist.
                </Text>
                <View className="flex-row flex-wrap justify-center">
                  {SUGGESTIONS.map((s) => (
                    <SuggestionChip key={s} label={s} onPress={() => handleSuggestion(s)} />
                  ))}
                </View>
              </View>
            )
          }
        />

        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
