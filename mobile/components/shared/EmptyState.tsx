import { View, Text } from 'react-native'
import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      {icon && <View className="mb-4">{icon}</View>}
      <Text className="text-lg font-sans-semibold text-foreground text-center mb-2">
        {title}
      </Text>
      {description && (
        <Text className="text-sm text-muted text-center mb-6">
          {description}
        </Text>
      )}
      {action}
    </View>
  )
}
