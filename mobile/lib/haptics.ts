import * as Haptics from 'expo-haptics'

export const haptic = {
  /** Item added, contribution received, event created */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Tab switch, pull-to-refresh */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Button press, card tap */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Validation failure, network error */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  /** Selection change */
  selection: () => Haptics.selectionAsync(),
}
