import { View, Text, ScrollView, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { Badge } from '@/components/shared/Badge'
import { colors } from '@/constants/colors'
import {
  User,
  Crown,
  Bell,
  Shield,
  CircleHelp,
  LogOut,
  ChevronRight,
  Users,
  Calendar,
  ExternalLink,
} from 'lucide-react-native'
import type { Subscription } from '@/lib/types'

interface SettingRow {
  icon: any
  label: string
  onPress: () => void
  badge?: string
  destructive?: boolean
}

export default function SettingsScreen() {
  const { user, logout } = useAuth()

  const subQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiGet<Subscription | null>('/api/subscription'),
  })

  const isGold = subQuery.data?.status === 'ACTIVE'

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          haptic.medium()
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const sections: { title: string; rows: SettingRow[] }[] = [
    {
      title: 'Account',
      rows: [
        {
          icon: Crown,
          label: isGold ? 'Gold Member' : 'Upgrade to Gold',
          onPress: () => router.push('/subscription'),
          badge: isGold ? 'Active' : undefined,
        },
        {
          icon: Users,
          label: 'Gift Circle',
          onPress: () => router.push('/circle'),
        },
        {
          icon: Calendar,
          label: 'Events',
          onPress: () => router.push('/events'),
        },
        {
          icon: Bell,
          label: 'Notifications',
          onPress: () => router.push('/notifications'),
        },
      ],
    },
    {
      title: 'Support',
      rows: [
        {
          icon: Shield,
          label: 'Privacy Policy',
          onPress: () => Linking.openURL('https://giftist.ai/privacy'),
        },
        {
          icon: ExternalLink,
          label: 'Terms of Service',
          onPress: () => Linking.openURL('https://giftist.ai/terms'),
        },
        {
          icon: CircleHelp,
          label: 'Help & Support',
          onPress: () => Linking.openURL('https://giftist.ai'),
        },
      ],
    },
    {
      title: '',
      rows: [
        {
          icon: LogOut,
          label: 'Sign Out',
          onPress: handleLogout,
          destructive: true,
        },
      ],
    },
  ]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-4 py-3">
          <Text className="text-2xl font-sans-bold text-foreground">Settings</Text>
        </View>

        {/* Profile Card */}
        <View className="mx-4 mb-6 bg-card border border-border rounded-2xl p-4 flex-row items-center">
          {user?.image ? (
            <Image
              source={{ uri: user.image }}
              style={{ width: 56, height: 56, borderRadius: 28 }}
            />
          ) : (
            <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center">
              <User size={24} color={colors.primary.DEFAULT} />
            </View>
          )}
          <View className="ml-4 flex-1">
            <View className="flex-row items-center">
              <Text className="text-lg font-sans-semibold text-foreground">
                {user?.name || 'User'}
              </Text>
              {isGold && (
                <Crown size={16} color={colors.warning.DEFAULT} className="ml-1.5" />
              )}
            </View>
            <Text className="text-sm text-muted">
              {user?.phone || user?.email || ''}
            </Text>
          </View>
        </View>

        {/* Setting Sections */}
        {sections.map((section, si) => (
          <View key={si} className="mb-4">
            {section.title && (
              <Text className="px-4 mb-2 text-xs font-sans-semibold text-muted uppercase tracking-wider">
                {section.title}
              </Text>
            )}
            <View className="mx-4 bg-card border border-border rounded-2xl overflow-hidden">
              {section.rows.map((row, ri) => (
                <HapticButton
                  key={ri}
                  onPress={row.onPress}
                  className={`flex-row items-center px-4 py-3.5 ${
                    ri < section.rows.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <row.icon
                    size={20}
                    color={row.destructive ? colors.destructive.DEFAULT : colors.foreground}
                  />
                  <Text
                    className={`flex-1 ml-3 text-base font-sans ${
                      row.destructive ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    {row.label}
                  </Text>
                  {row.badge && <Badge label={row.badge} variant="success" small />}
                  {!row.destructive && (
                    <ChevronRight size={18} color={colors.muted} />
                  )}
                </HapticButton>
              ))}
            </View>
          </View>
        ))}

        <Text className="text-center text-xs text-muted mt-4">
          Giftist v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
