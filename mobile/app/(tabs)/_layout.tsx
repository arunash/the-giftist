import { Redirect, Tabs } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { Home, MessageCircle, Bell, Wallet, Settings } from 'lucide-react-native'
import { colors } from '@/constants/colors'

export default function TabLayout() {
  const isLoggedIn = useAuth((s) => s.isLoggedIn)

  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card.DEFAULT,
          borderTopColor: colors.border.DEFAULT,
          borderTopWidth: 1,
          paddingTop: 6,
          height: 88,
        },
        tabBarLabelStyle: {
          fontFamily: 'DMSans-Medium',
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
