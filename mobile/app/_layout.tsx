import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuth } from '@/hooks/useAuth'
import { useNotificationListeners } from '@/hooks/useNotifications'
import '../global.css'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min
      gcTime: 10 * 60 * 1000, // 10 min
      retry: 2,
    },
  },
})

export default function RootLayout() {
  const initialize = useAuth((s) => s.initialize)
  const isLoading = useAuth((s) => s.isLoading)

  const [fontsLoaded] = useFonts({
    'DMSans-Regular': require('@/assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('@/assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold': require('@/assets/fonts/DMSans-SemiBold.ttf'),
    'DMSans-Bold': require('@/assets/fonts/DMSans-Bold.ttf'),
  })

  useNotificationListeners()

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, isLoading])

  if (!fontsLoaded || isLoading) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="items/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="events/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="events/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="events/create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="subscription" options={{ presentation: 'modal' }} />
          <Stack.Screen name="circle/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="circle/add" options={{ presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
