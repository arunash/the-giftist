import { Text } from 'react-native'
import { HapticButton } from '@/components/shared/HapticButton'

interface Props {
  label: string
  onPress: () => void
}

export function SuggestionChip({ label, onPress }: Props) {
  return (
    <HapticButton
      onPress={onPress}
      hapticType="selection"
      className="bg-primary/5 border border-primary/20 rounded-full px-4 py-2 mr-2 mb-2"
    >
      <Text className="text-sm text-primary font-sans-medium">{label}</Text>
    </HapticButton>
  )
}
