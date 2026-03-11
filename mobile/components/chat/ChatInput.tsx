import { useState } from 'react'
import { View, TextInput, Platform } from 'react-native'
import { Send } from 'lucide-react-native'
import { HapticButton } from '@/components/shared/HapticButton'
import { colors } from '@/constants/colors'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <View className="flex-row items-end px-4 py-3 bg-background border-t border-border">
      <TextInput
        className="flex-1 bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground font-sans max-h-24"
        placeholder="Ask your gift concierge..."
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        multiline
        editable={!disabled}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        blurOnSubmit={Platform.OS === 'ios'}
      />
      <HapticButton
        onPress={handleSend}
        disabled={disabled || !text.trim()}
        hapticType="medium"
        className="ml-2 mb-0.5"
      >
        <View
          className={`w-10 h-10 rounded-full items-center justify-center ${
            text.trim() && !disabled ? 'bg-primary' : 'bg-surface-raised'
          }`}
        >
          <Send
            size={18}
            color={text.trim() && !disabled ? '#fff' : colors.muted}
          />
        </View>
      </HapticButton>
    </View>
  )
}
