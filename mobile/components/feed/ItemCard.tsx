import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ExternalLink, Gift } from 'lucide-react-native'
import { HapticButton } from '@/components/shared/HapticButton'
import { Badge } from '@/components/shared/Badge'
import { colors } from '@/constants/colors'
import type { Item } from '@/lib/types'

interface Props {
  item: Item
}

export function ItemCard({ item }: Props) {
  const fundingPercent = item.goalAmount
    ? Math.min(100, Math.round((item.fundedAmount / item.goalAmount) * 100))
    : 0

  return (
    <HapticButton
      onPress={() => router.push(`/items/${item.id}`)}
      className="bg-card rounded-2xl border border-border overflow-hidden mb-3"
    >
      {/* Image */}
      {item.image && (
        <Image
          source={{ uri: item.image }}
          style={{ width: '100%', height: 200 }}
          contentFit="cover"
          placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
          transition={300}
        />
      )}

      {/* Content */}
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-sans-semibold text-foreground" numberOfLines={2}>
              {item.name}
            </Text>
            <Text className="text-xs text-muted mt-1">{item.domain}</Text>
          </View>
          {item.price && (
            <Text className="text-lg font-sans-bold text-foreground">
              {item.price}
            </Text>
          )}
        </View>

        {/* Funding Progress */}
        {item.goalAmount && item.goalAmount > 0 && (
          <View className="mt-3">
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs text-muted">
                ${item.fundedAmount.toFixed(0)} raised
              </Text>
              <Text className="text-xs font-sans-medium text-success">
                {fundingPercent}%
              </Text>
            </View>
            <View className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
              <View
                className="h-full bg-success rounded-full"
                style={{ width: `${fundingPercent}%` }}
              />
            </View>
          </View>
        )}

        {/* Tags */}
        {item.tags && (
          <View className="flex-row flex-wrap gap-1.5 mt-3">
            {item.tags.split(',').slice(0, 3).map((tag) => (
              <Badge key={tag} label={tag.trim()} variant="muted" small />
            ))}
          </View>
        )}

        {item.isPurchased && (
          <Badge label="Purchased" variant="success" />
        )}
      </View>
    </HapticButton>
  )
}
