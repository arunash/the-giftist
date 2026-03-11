import { ActivityIndicator, View } from 'react-native'
import { colors } from '@/constants/colors'

interface Props {
  size?: 'small' | 'large'
  color?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 'large', color = colors.primary.DEFAULT, fullScreen }: Props) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size={size} color={color} />
      </View>
    )
  }

  return <ActivityIndicator size={size} color={color} />
}
