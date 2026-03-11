import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import {
  Plus,
  ShoppingCart,
  Heart,
  Calendar,
  DollarSign,
} from 'lucide-react-native'
import { HapticButton } from '@/components/shared/HapticButton'
import { colors } from '@/constants/colors'
import { formatDistanceToNow } from 'date-fns'
import type { ActivityEvent } from '@/lib/types'

const ICONS: Record<string, any> = {
  ITEM_ADDED: Plus,
  PURCHASE: ShoppingCart,
  CONTRIBUTION: DollarSign,
  EVENT_CREATED: Calendar,
  EVENT_ITEM_ADDED: Heart,
}

interface Props {
  activity: ActivityEvent
}

export function ActivityCard({ activity }: Props) {
  const Icon = ICONS[activity.type] || Plus
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {}
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })

  return (
    <HapticButton
      onPress={() => {
        if (activity.itemId) router.push(`/items/${activity.itemId}`)
      }}
      className="flex-row items-start p-4 bg-card border-b border-border"
    >
      {/* Avatar / Icon */}
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
        {activity.user?.image ? (
          <Image
            source={{ uri: activity.user.image }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <Icon size={18} color={colors.primary.DEFAULT} />
        )}
      </View>

      <View className="flex-1">
        <Text className="text-sm text-foreground font-sans">
          <Text className="font-sans-semibold">{activity.user?.name || 'You'}</Text>
          {' '}
          {activity.type === 'ITEM_ADDED' && 'added an item'}
          {activity.type === 'PURCHASE' && 'marked as purchased'}
          {activity.type === 'CONTRIBUTION' && 'received a contribution'}
          {activity.type === 'EVENT_CREATED' && 'created an event'}
          {activity.type === 'EVENT_ITEM_ADDED' && 'added to an event'}
        </Text>

        {/* Item thumbnail */}
        {activity.item && (
          <View className="flex-row items-center mt-2 bg-surface rounded-xl p-2">
            {activity.item.image && (
              <Image
                source={{ uri: activity.item.image }}
                style={{ width: 40, height: 40, borderRadius: 8 }}
                contentFit="cover"
              />
            )}
            <View className="ml-2 flex-1">
              <Text className="text-xs font-sans-medium text-foreground" numberOfLines={1}>
                {activity.item.name}
              </Text>
              {activity.item.price && (
                <Text className="text-xs text-muted">{activity.item.price}</Text>
              )}
            </View>
          </View>
        )}

        <Text className="text-xs text-muted mt-1">{timeAgo}</Text>
      </View>
    </HapticButton>
  )
}
