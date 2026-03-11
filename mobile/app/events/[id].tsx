import { View, Text, FlatList, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiDelete } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { ItemCard } from '@/components/feed/ItemCard'
import { Badge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { colors } from '@/constants/colors'
import { ArrowLeft, Calendar, Share2, Trash2, Gift } from 'lucide-react-native'
import { format, formatDistanceToNow } from 'date-fns'
import * as Linking from 'expo-linking'
import type { Event, Item } from '@/lib/types'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiGet<Event & { items: { item: Item }[] }>(`/api/events/${id}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/api/events/${id}`),
    onSuccess: () => {
      haptic.success()
      queryClient.invalidateQueries({ queryKey: ['events'] })
      router.back()
    },
  })

  const handleDelete = () => {
    Alert.alert('Delete Event', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ])
  }

  const handleShare = () => {
    if (query.data?.shareUrl) {
      Linking.openURL(`https://giftist.ai/events/${query.data.shareUrl}`)
    }
  }

  if (query.isLoading) return <LoadingSpinner fullScreen />

  const event = query.data
  if (!event) return null

  const items = event.items?.map((ei) => ei.item) || []

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <HapticButton onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </HapticButton>
        <View className="flex-row gap-3">
          <HapticButton onPress={handleShare}>
            <Share2 size={22} color={colors.foreground} />
          </HapticButton>
          <HapticButton onPress={handleDelete}>
            <Trash2 size={22} color={colors.destructive.DEFAULT} />
          </HapticButton>
        </View>
      </View>

      {/* Event Info */}
      <View className="px-4 pb-4 border-b border-border">
        <View className="flex-row items-center mb-2">
          <Calendar size={18} color={colors.primary.DEFAULT} />
          <Badge label={event.type} variant="primary" small />
        </View>
        <Text className="text-2xl font-sans-bold text-foreground mb-1">
          {event.name}
        </Text>
        <Text className="text-sm text-muted">
          {format(new Date(event.date), 'EEEE, MMMM d, yyyy')} ·{' '}
          {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
        </Text>
        {event.description && (
          <Text className="text-sm text-foreground mt-2">{event.description}</Text>
        )}
      </View>

      {/* Items */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <Text className="text-base font-sans-semibold text-foreground mb-3">
            Gift Ideas ({items.length})
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Gift size={32} color={colors.muted} />}
            title="No items linked"
            description="Add items to this event from your wishlist"
          />
        }
      />
    </SafeAreaView>
  )
}
