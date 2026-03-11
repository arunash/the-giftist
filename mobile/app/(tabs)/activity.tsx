import { useState, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { useOfflineCache } from '@/hooks/useOfflineCache'
import { ActivityCard } from '@/components/activity/ActivityCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import { Activity } from 'lucide-react-native'
import type { ActivityEvent } from '@/lib/types'

type Tab = 'mine' | 'community'

export default function ActivityScreen() {
  const [tab, setTab] = useState<Tab>('mine')
  const [refreshing, setRefreshing] = useState(false)

  const query = useQuery({
    queryKey: ['activity', tab],
    queryFn: () =>
      apiGet<ActivityEvent[]>(
        `/api/activity?visibility=${tab === 'mine' ? 'PRIVATE' : 'PUBLIC'}`
      ),
  })

  useOfflineCache(['activity', tab])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    haptic.medium()
    await query.refetch()
    setRefreshing(false)
  }, [query])

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3">
        <Text className="text-2xl font-sans-bold text-foreground">Activity</Text>
      </View>

      {/* Tab Switcher */}
      <View className="flex-row mx-4 mb-3 bg-surface rounded-xl p-1">
        {(['mine', 'community'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              haptic.selection()
              setTab(t)
            }}
            className={`flex-1 py-2 rounded-lg ${tab === t ? 'bg-card' : ''}`}
          >
            <Text
              className={`text-center text-sm font-sans-medium ${
                tab === t ? 'text-foreground' : 'text-muted'
              }`}
            >
              {t === 'mine' ? 'Mine' : 'Community'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={query.data || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActivityCard activity={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <LoadingSpinner fullScreen />
          ) : (
            <EmptyState
              icon={<Activity size={40} color={colors.muted} />}
              title="No activity yet"
              description={
                tab === 'mine'
                  ? 'Your wishlist activity will appear here'
                  : 'Activity from your circle will appear here'
              }
            />
          )
        }
      />
    </SafeAreaView>
  )
}
