import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function AuthLayout() {
  const isLoggedIn = useAuth((s) => s.isLoggedIn)

  if (isLoggedIn) {
    return <Redirect href="/(tabs)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="verify" />
    </Stack>
  )
}
