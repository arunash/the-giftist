import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { apiPost, apiDelete } from './api'
import { router } from 'expo-router'

// Configure notification display behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Not a physical device, skipping')
    return null
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted')
    return null
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e84d3d',
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId })

  // Register with backend
  await apiPost('/api/devices', {
    pushToken: pushToken.data,
    platform: Platform.OS,
  })

  return pushToken.data
}

export async function unregisterPushNotifications(token: string): Promise<void> {
  await apiDelete('/api/devices', { pushToken: token })
}

export function setupNotificationListeners() {
  // Handle notification tapped (app in background/killed)
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const url = response.notification.request.content.data?.url as string
      if (url) {
        router.push(url as any)
      }
    }
  )

  // Handle notification received while app is foregrounded
  const receivedListener = Notifications.addNotificationReceivedListener(
    (_notification) => {
      // Could update badge count or show in-app toast
    }
  )

  return () => {
    responseListener.remove()
    receivedListener.remove()
  }
}
