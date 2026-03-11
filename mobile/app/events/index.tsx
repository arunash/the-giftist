import { useState, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import { ArrowLeft, Plus, Calendar, Gift } from 'lucide-react-native'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import type { Event } from '@/lib/types'

export default function EventsListScreen() {
  const [refreshing, setRefreshing] = useState(false)

  const query = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<Event[]>('/api/events'),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    haptic.medium()
    await query.refetch()
    setRefreshing(false)
  }, [])

  const events = (query.data || []).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center">
          <HapticButton onPress={() => router.back()} className="mr-3">
            <ArrowLeft size={24} color={colors.foreground} />
          </HapticButton>
          <Text className="text-xl font-sans-bold text-foreground">Events</Text>
        </View>
        <HapticButton
          onPress={() => router.push('/events/create')}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
        >
          <Plus size={20} color="#fff" />
        </HapticButton>
      </View>

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={({ item: event }) => {
          const past = isPast(new Date(event.date))
          return (
            <HapticButton
              onPress={() => router.push(`/events/${event.id}`)}
              className="flex-row items-center px-4 py-4 border-b border-border"
            >
              <View className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${past ? 'bg-surface-raised' : 'bg-primary/10'}`}>
                <Calendar size={22} color={past ? colors.muted : colors.primary.DEFAULT} />
              </View>
              <View className="flex-1">
                <Text className={`text-base font-sans-semibold ${past ? 'text-muted' : 'text-foreground'}`}>
                  {event.name}
                </Text>
                <Text className="text-xs text-muted mt-0.5">
                  {format(new Date(event.date), 'MMM d, yyyy')}
                  {!past && ` · ${formatDistanceToNow(new Date(event.date))}`}
                </Text>
              </View>
              <Badge
                label={event.type}
                variant={past ? 'muted' : 'primary'}
                small
              />
            </HapticButton>
          )
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <LoadingSpinner fullScreen />
          ) : (
            <EmptyState
              icon={<Gift size={40} color={colors.muted} />}
              title="No events yet"
              description="Create an event to organize gifts for birthdays, holidays, and more"
              action={
                <HapticButton
                  onPress={() => router.push('/events/create')}
                  className="bg-primary rounded-xl px-6 py-3"
                >
                  <Text className="text-sm font-sans-semibold text-white">Create Event</Text>
                </HapticButton>
              }
            />
          )
        }
      />
    </SafeAreaView>
  )
}
