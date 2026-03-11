import { View, Text, ScrollView, Linking, Alert, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiDelete } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { Badge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  ShoppingCart,
  Trash2,
  Edit3,
} from 'lucide-react-native'
import type { Item } from '@/lib/types'

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['item', id],
    queryFn: () => apiGet<Item>(`/api/items/${id}`),
  })

  const purchaseMutation = useMutation({
    mutationFn: () => apiPatch(`/api/items/${id}`, { isPurchased: true }),
    onSuccess: () => {
      haptic.success()
      queryClient.invalidateQueries({ queryKey: ['item', id] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/api/items/${id}`),
    onSuccess: () => {
      haptic.success()
      queryClient.invalidateQueries({ queryKey: ['items'] })
      router.back()
    },
  })

  const handleDelete = () => {
    Alert.alert('Remove Item', 'Remove this item from your wishlist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ])
  }

  const handleShare = async () => {
    const item = query.data
    if (!item) return
    await Share.share({
      message: `Check out ${item.name} on my wishlist! ${item.url}`,
    })
  }

  if (query.isLoading) return <LoadingSpinner fullScreen />

  const item = query.data
  if (!item) return null

  const fundingPercent = item.goalAmount
    ? Math.min(100, Math.round((item.fundedAmount / item.goalAmount) * 100))
    : 0

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 absolute top-0 left-0 right-0 z-10">
          <HapticButton
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-card/80 items-center justify-center"
          >
            <ArrowLeft size={22} color={colors.foreground} />
          </HapticButton>
          <View className="flex-row gap-2">
            <HapticButton
              onPress={handleShare}
              className="w-10 h-10 rounded-full bg-card/80 items-center justify-center"
            >
              <Share2 size={20} color={colors.foreground} />
            </HapticButton>
            <HapticButton
              onPress={handleDelete}
              className="w-10 h-10 rounded-full bg-card/80 items-center justify-center"
            >
              <Trash2 size={20} color={colors.destructive.DEFAULT} />
            </HapticButton>
          </View>
        </View>

        {/* Image */}
        {item.image && (
          <Image
            source={{ uri: item.image }}
            style={{ width: '100%', height: 320 }}
            contentFit="cover"
            placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
            transition={300}
          />
        )}

        {/* Content */}
        <View className="px-4 pt-4 pb-8">
          {item.isPurchased && (
            <Badge label="Purchased" variant="success" />
          )}

          <Text className="text-2xl font-sans-bold text-foreground mt-2">
            {item.name}
          </Text>
          <Text className="text-sm text-muted mt-1">{item.domain}</Text>

          {item.price && (
            <Text className="text-xl font-sans-bold text-foreground mt-3">
              {item.price}
            </Text>
          )}

          {/* Funding Progress */}
          {item.goalAmount && item.goalAmount > 0 && (
            <View className="mt-4 bg-card border border-border rounded-2xl p-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm font-sans-medium text-foreground">
                  Funding Progress
                </Text>
                <Text className="text-sm font-sans-semibold text-success">
                  {fundingPercent}%
                </Text>
              </View>
              <View className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <View
                  className="h-full bg-success rounded-full"
                  style={{ width: `${fundingPercent}%` }}
                />
              </View>
              <Text className="text-xs text-muted mt-2">
                ${item.fundedAmount.toFixed(2)} of ${item.goalAmount.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Notes */}
          {item.notes && (
            <View className="mt-4">
              <Text className="text-sm font-sans-medium text-foreground mb-1">Notes</Text>
              <Text className="text-sm text-muted">{item.notes}</Text>
            </View>
          )}

          {/* Tags */}
          {item.tags && (
            <View className="flex-row flex-wrap gap-2 mt-4">
              {item.tags.split(',').map((tag) => (
                <Badge key={tag} label={tag.trim()} variant="muted" />
              ))}
            </View>
          )}

          {/* Actions */}
          <View className="flex-row gap-3 mt-6">
            <HapticButton
              onPress={() => Linking.openURL(item.url)}
              className="flex-1 flex-row items-center justify-center bg-primary rounded-xl py-3.5"
              hapticType="medium"
            >
              <ExternalLink size={18} color="#fff" />
              <Text className="text-base font-sans-semibold text-white ml-2">
                View in Store
              </Text>
            </HapticButton>

            {!item.isPurchased && (
              <HapticButton
                onPress={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending}
                className="flex-row items-center justify-center bg-card border border-border rounded-xl px-5 py-3.5"
                hapticType="success"
              >
                <ShoppingCart size={18} color={colors.foreground} />
              </HapticButton>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
