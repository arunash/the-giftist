import { create } from 'zustand'
import type { ChatMessage } from '@/lib/types'

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingText: string
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  appendStreamText: (text: string) => void
  resetStreamText: () => void
  finalizeStream: (id: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingText: '',

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  appendStreamText: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),

  resetStreamText: () => set({ streamingText: '' }),

  finalizeStream: (id) => {
    const { streamingText } = get()
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          role: 'assistant' as const,
          content: streamingText,
          createdAt: new Date().toISOString(),
        },
      ],
      streamingText: '',
      isStreaming: false,
    }))
  },
}))
