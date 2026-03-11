import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Bell, Camera, Plus, X } from 'lucide-react-native'
import { apiGet } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { useAuth } from '@/hooks/useAuth'
import { useFeedStore } from '@/hooks/useFeed'
import { useOfflineCache } from '@/hooks/useOfflineCache'
import { ItemCard } from '@/components/feed/ItemCard'
import { EventCarousel } from '@/components/feed/EventCarousel'
import { TrendingCarousel } from '@/components/feed/TrendingCarousel'
import { EmptyState } from '@/components/shared/EmptyState'
import { HapticButton } from '@/components/shared/HapticButton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import type { Item, Event } from '@/lib/types'

export default function FeedScreen() {
  const user = useAuth((s) => s.user)
  const { selectedEventId, filterByEvent } = useFeedStore()
  const [refreshing, setRefreshing] = useState(false)

  const itemsQuery = useQuery({
    queryKey: ['items', selectedEventId],
    queryFn: () =>
      apiGet<Item[]>(
        `/api/items${selectedEventId ? `?eventId=${selectedEventId}` : ''}`
      ),
  })

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<Event[]>('/api/events'),
  })

  const trendingQuery = useQuery({
    queryKey: ['trending'],
    queryFn: () => apiGet('/api/trending'),
    staleTime: 10 * 60 * 1000, // 10 min
  })

  // Offline cache
  useOfflineCache(['items', selectedEventId])
  useOfflineCache(['events'])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    haptic.medium()
    await Promise.all([
      itemsQuery.refetch(),
      eventsQuery.refetch(),
      trendingQuery.refetch(),
    ])
    setRefreshing(false)
  }, [])

  const items = itemsQuery.data || []
  const events = (eventsQuery.data || [])
    .filter((e) => new Date(e.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6)

  const selectedEvent = selectedEventId
    ? (eventsQuery.data || []).find((e) => e.id === selectedEventId)
    : null

  const greeting = user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Hi there'

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="text-2xl font-sans-bold text-foreground">{greeting}</Text>
          <Text className="text-sm text-muted">Your wishlist</Text>
        </View>
        <View className="flex-row gap-2">
          <HapticButton
            onPress={() => router.push('/scan')}
            className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center"
          >
            <Camera size={20} color={colors.foreground} />
          </HapticButton>
          <HapticButton
            onPress={() => router.push('/notifications')}
            className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center"
          >
            <Bell size={20} color={colors.foreground} />
          </HapticButton>
        </View>
      </View>

      {/* Event Filter Pill */}
      {selectedEvent && (
        <View className="px-4 mb-2">
          <View className="flex-row items-center bg-primary/10 rounded-full px-3 py-1.5 self-start">
            <Text className="text-sm font-sans-medium text-primary mr-2">
              {selectedEvent.name}
            </Text>
            <Pressable onPress={() => filterByEvent(null)}>
              <X size={14} color={colors.primary.DEFAULT} />
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
        ListHeaderComponent={
          <>
            <EventCarousel events={events} onSelectEvent={filterByEvent} />
            {trendingQuery.data?.length > 0 && (
              <TrendingCarousel items={trendingQuery.data} />
            )}
          </>
        }
        ListEmptyComponent={
          itemsQuery.isLoading ? (
            <LoadingSpinner fullScreen />
          ) : (
            <EmptyState
              title="No items yet"
              description="Start by adding something you love — paste a URL or scan a product"
              action={
                <HapticButton
                  onPress={() => router.push('/chat')}
                  className="bg-primary rounded-xl px-6 py-3"
                >
                  <Text className="text-sm font-sans-semibold text-white">
                    Chat with your concierge
                  </Text>
                </HapticButton>
              }
            />
          )
        }
      />
    </SafeAreaView>
  )
}
