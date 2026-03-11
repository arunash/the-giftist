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
import { ArrowLeft, Plus, Users, User } from 'lucide-react-native'
import type { CircleMember } from '@/lib/types'

export default function CircleScreen() {
  const [refreshing, setRefreshing] = useState(false)

  const query = useQuery({
    queryKey: ['circle'],
    queryFn: () => apiGet<CircleMember[]>('/api/circle'),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    haptic.medium()
    await query.refetch()
    setRefreshing(false)
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center">
          <HapticButton onPress={() => router.back()} className="mr-3">
            <ArrowLeft size={24} color={colors.foreground} />
          </HapticButton>
          <Text className="text-xl font-sans-bold text-foreground">Gift Circle</Text>
        </View>
        <HapticButton
          onPress={() => router.push('/circle/add')}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
        >
          <Plus size={20} color="#fff" />
        </HapticButton>
      </View>

      <FlatList
        data={query.data || []}
        keyExtractor={(m) => m.id}
        renderItem={({ item: member }) => (
          <View className="flex-row items-center px-4 py-3.5 border-b border-border">
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
              <User size={18} color={colors.primary.DEFAULT} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-sans-medium text-foreground">
                {member.name || member.phone}
              </Text>
              {member.name && (
                <Text className="text-xs text-muted">{member.phone}</Text>
              )}
            </View>
            {member.relationship && (
              <Badge label={member.relationship} variant="muted" small />
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <LoadingSpinner fullScreen />
          ) : (
            <EmptyState
              icon={<Users size={40} color={colors.muted} />}
              title="Your circle is empty"
              description="Add friends and family who you exchange gifts with"
              action={
                <HapticButton
                  onPress={() => router.push('/circle/add')}
                  className="bg-primary rounded-xl px-6 py-3"
                >
                  <Text className="text-sm font-sans-semibold text-white">Add Members</Text>
                </HapticButton>
              }
            />
          )
        }
      />
    </SafeAreaView>
  )
}
