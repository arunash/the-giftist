import { Pressable, type PressableProps, type ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { haptic } from '@/lib/haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface Props extends PressableProps {
  hapticType?: 'light' | 'medium' | 'success' | 'selection'
  scaleOnPress?: number
  style?: ViewStyle
}

export function HapticButton({
  hapticType = 'light',
  scaleOnPress = 0.97,
  onPress,
  children,
  style,
  ...props
}: Props) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(scaleOnPress, { damping: 15 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
      }}
      onPress={(e) => {
        haptic[hapticType]()
        onPress?.(e)
      }}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  )
}
