import { View, Text, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { Badge } from '@/components/shared/Badge'
import { colors } from '@/constants/colors'
import { X, Crown, Check, Sparkles, MessageCircle, Users, Gift } from 'lucide-react-native'
import type { Subscription } from '@/lib/types'

const GOLD_FEATURES = [
  { icon: MessageCircle, label: 'Unlimited concierge conversations' },
  { icon: Users, label: 'Priority gift recommendations' },
  { icon: Gift, label: 'Advanced event management' },
  { icon: Sparkles, label: 'AI product scanning' },
]

export default function SubscriptionScreen() {
  const subQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiGet<Subscription | null>('/api/subscription'),
  })

  const isGold = subQuery.data?.status === 'ACTIVE'

  const handleUpgrade = async () => {
    haptic.medium()
    // Open Stripe Checkout in browser, deep link back on success
    const token = await getToken()
    const url = `https://giftist.ai/api/subscription/checkout?mobile=true&token=${token}`
    await WebBrowser.openBrowserAsync(url, {
      dismissButtonStyle: 'close',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <HapticButton onPress={() => router.back()}>
          <X size={24} color={colors.foreground} />
        </HapticButton>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View className="items-center mt-4 mb-8">
          <View className="w-20 h-20 rounded-3xl bg-warning/10 items-center justify-center mb-4">
            <Crown size={40} color={colors.warning.DEFAULT} />
          </View>
          <Text className="text-3xl font-sans-bold text-foreground">Giftist Gold</Text>
          <Text className="text-base text-muted mt-1 text-center">
            Unlock the full power of your AI gift concierge
          </Text>
        </View>

        {/* Status */}
        {isGold && (
          <View className="bg-success-light border border-success/20 rounded-2xl p-4 mb-6 flex-row items-center">
            <Check size={20} color={colors.success.DEFAULT} />
            <Text className="text-base font-sans-medium text-success ml-2">
              You're a Gold member!
            </Text>
          </View>
        )}

        {/* Features */}
        <View className="bg-card border border-border rounded-2xl p-5 mb-6">
          {GOLD_FEATURES.map((feature, i) => (
            <View
              key={i}
              className={`flex-row items-center py-3 ${
                i < GOLD_FEATURES.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <View className="w-10 h-10 rounded-xl bg-warning/10 items-center justify-center mr-3">
                <feature.icon size={20} color={colors.warning.DEFAULT} />
              </View>
              <Text className="text-sm font-sans-medium text-foreground flex-1">
                {feature.label}
              </Text>
              <Check size={18} color={colors.success.DEFAULT} />
            </View>
          ))}
        </View>

        {/* Pricing */}
        {!isGold && (
          <View className="bg-card border border-primary/20 rounded-2xl p-5 mb-6">
            <View className="flex-row items-baseline">
              <Text className="text-3xl font-sans-bold text-foreground">$9.99</Text>
              <Text className="text-base text-muted ml-1">/month</Text>
            </View>
            <Text className="text-xs text-muted mt-1">Cancel anytime</Text>
          </View>
        )}

        {/* CTA */}
        {!isGold && (
          <HapticButton
            onPress={handleUpgrade}
            hapticType="success"
            className="bg-primary rounded-2xl py-4 flex-row items-center justify-center"
          >
            <Crown size={20} color="#fff" />
            <Text className="text-lg font-sans-bold text-white ml-2">
              Upgrade to Gold
            </Text>
          </HapticButton>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
