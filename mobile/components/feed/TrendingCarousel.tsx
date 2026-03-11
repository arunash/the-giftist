import { View, Text, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { TrendingUp } from 'lucide-react-native'
import { HapticButton } from '@/components/shared/HapticButton'
import { colors } from '@/constants/colors'

interface TrendingItem {
  name: string
  price?: string
  image?: string
  url?: string
}

interface Props {
  items: TrendingItem[]
  onSelect?: (item: TrendingItem) => void
}

export function TrendingCarousel({ items, onSelect }: Props) {
  if (items.length === 0) return null

  return (
    <View className="mb-4">
      <View className="flex-row items-center px-4 mb-3">
        <TrendingUp size={18} color={colors.primary.DEFAULT} />
        <Text className="text-lg font-sans-semibold text-foreground ml-2">
          Trending for You
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {items.map((item, i) => (
          <HapticButton
            key={i}
            onPress={() => onSelect?.(item)}
            className="bg-card border border-border rounded-2xl overflow-hidden w-40"
          >
            {item.image && (
              <Image
                source={{ uri: item.image }}
                style={{ width: 160, height: 120 }}
                contentFit="cover"
                placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
                transition={200}
              />
            )}
            <View className="p-3">
              <Text className="text-sm font-sans-medium text-foreground" numberOfLines={2}>
                {item.name}
              </Text>
              {item.price && (
                <Text className="text-xs text-muted mt-1">{item.price}</Text>
              )}
            </View>
          </HapticButton>
        ))}
      </ScrollView>
    </View>
  )
}
