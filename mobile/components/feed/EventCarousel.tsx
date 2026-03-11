import { View, Text, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Calendar, ChevronRight } from 'lucide-react-native'
import { HapticButton } from '@/components/shared/HapticButton'
import { colors } from '@/constants/colors'
import { formatDistanceToNow } from 'date-fns'
import type { Event } from '@/lib/types'

interface Props {
  events: Event[]
  onSelectEvent?: (eventId: string) => void
}

export function EventCarousel({ events, onSelectEvent }: Props) {
  if (events.length === 0) return null

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-lg font-sans-semibold text-foreground">
          Upcoming Events
        </Text>
        <HapticButton onPress={() => router.push('/events')}>
          <View className="flex-row items-center">
            <Text className="text-sm text-primary mr-0.5">See all</Text>
            <ChevronRight size={14} color={colors.primary.DEFAULT} />
          </View>
        </HapticButton>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {events.map((event) => {
          const daysUntil = formatDistanceToNow(new Date(event.date), { addSuffix: false })
          return (
            <HapticButton
              key={event.id}
              onPress={() => onSelectEvent?.(event.id)}
              className="bg-card border border-border rounded-2xl p-4 w-48"
            >
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center mb-3">
                <Calendar size={20} color={colors.primary.DEFAULT} />
              </View>
              <Text className="text-sm font-sans-semibold text-foreground" numberOfLines={1}>
                {event.name}
              </Text>
              <Text className="text-xs text-muted mt-1">
                {daysUntil}
              </Text>
              <Text className="text-xs text-primary mt-1 font-sans-medium">
                {event.type}
              </Text>
            </HapticButton>
          )
        })}
      </ScrollView>
    </View>
  )
}
