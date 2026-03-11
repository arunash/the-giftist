import { View, Text, Linking } from 'react-native'
import { Image } from 'expo-image'
import { ExternalLink, Plus } from 'lucide-react-native'
import { HapticButton } from '@/components/shared/HapticButton'
import { apiPost } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { colors } from '@/constants/colors'
import type { ProductData } from '@/lib/parse-chat-content'

interface Props {
  product: ProductData
}

export function ProductCard({ product }: Props) {
  const handleAddToWishlist = async () => {
    if (product.url) {
      try {
        await apiPost('/api/items/from-url', { url: product.url })
        haptic.success()
      } catch {
        haptic.error()
      }
    }
  }

  const handleOpenLink = () => {
    if (product.url) {
      Linking.openURL(product.url)
    }
  }

  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden mb-1">
      {product.image && (
        <Image
          source={{ uri: product.image }}
          style={{ width: '100%', height: 140 }}
          contentFit="cover"
          placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
          transition={200}
        />
      )}
      <View className="p-3">
        <Text className="text-sm font-sans-semibold text-foreground" numberOfLines={2}>
          {product.name}
        </Text>
        {product.price && (
          <Text className="text-sm font-sans-bold text-foreground mt-1">
            {product.price}
          </Text>
        )}

        <View className="flex-row gap-2 mt-3">
          {product.url && (
            <HapticButton
              onPress={handleAddToWishlist}
              className="flex-1 flex-row items-center justify-center bg-primary rounded-xl py-2.5"
            >
              <Plus size={16} color="#fff" />
              <Text className="text-sm font-sans-medium text-white ml-1">Add</Text>
            </HapticButton>
          )}
          {product.url && (
            <HapticButton
              onPress={handleOpenLink}
              className="flex-row items-center justify-center bg-card border border-border rounded-xl px-4 py-2.5"
            >
              <ExternalLink size={16} color={colors.foreground} />
            </HapticButton>
          )}
        </View>
      </View>
    </View>
  )
}
