import { useState, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import { ArrowLeft, Bell, BellOff } from 'lucide-react-native'
import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '@/lib/types'

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<Notification[]>('/api/notifications'),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/notifications/${id}`, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    haptic.medium()
    await query.refetch()
    setRefreshing(false)
  }, [])

  const handlePress = (notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id)
    }

    // Navigate based on metadata
    const metadata = notification.metadata ? JSON.parse(notification.metadata) : {}
    if (metadata.itemId) {
      router.push(`/items/${metadata.itemId}`)
    } else if (metadata.eventId) {
      router.push(`/events/${metadata.eventId}`)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <HapticButton onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={24} color={colors.foreground} />
        </HapticButton>
        <Text className="text-xl font-sans-bold text-foreground">Notifications</Text>
      </View>

      <FlatList
        data={query.data || []}
        keyExtractor={(n) => n.id}
        renderItem={({ item: n }) => (
          <HapticButton
            onPress={() => handlePress(n)}
            className={`px-4 py-4 border-b border-border ${!n.read ? 'bg-primary/5' : ''}`}
          >
            <View className="flex-row items-start">
              <View className={`w-2 h-2 rounded-full mt-2 mr-3 ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
              <View className="flex-1">
                <Text className="text-sm font-sans-semibold text-foreground">
                  {n.title}
                </Text>
                <Text className="text-sm text-muted mt-0.5">{n.body}</Text>
                <Text className="text-xs text-muted mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </Text>
              </View>
            </View>
          </HapticButton>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <LoadingSpinner fullScreen />
          ) : (
            <EmptyState
              icon={<BellOff size={40} color={colors.muted} />}
              title="No notifications"
              description="You're all caught up!"
            />
          )
        }
      />
    </SafeAreaView>
  )
}
