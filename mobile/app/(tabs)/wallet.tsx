import { useCallback, useState } from 'react'
import { View, Text, FlatList, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { colors } from '@/constants/colors'
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { Wallet, WalletTransaction } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

export default function WalletScreen() {
  const [refreshing, setRefreshing] = useState(false)

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiGet<Wallet>('/api/wallet'),
  })

  const txQuery = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => apiGet<WalletTransaction[]>('/api/wallet/transactions'),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    haptic.medium()
    await Promise.all([walletQuery.refetch(), txQuery.refetch()])
    setRefreshing(false)
  }, [])

  const balance = walletQuery.data?.balance ?? 0

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3">
        <Text className="text-2xl font-sans-bold text-foreground">Wallet</Text>
      </View>

      {/* Balance Card */}
      <View className="mx-4 mb-4 bg-card border border-border rounded-2xl p-6">
        <Text className="text-sm text-muted mb-1">Available Balance</Text>
        <Text className="text-4xl font-sans-bold text-foreground">
          ${balance.toFixed(2)}
        </Text>
      </View>

      {/* Transactions */}
      <Text className="px-4 text-base font-sans-semibold text-foreground mb-2">
        Transactions
      </Text>

      <FlatList
        data={txQuery.data || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isCredit = item.type === 'CONTRIBUTION' || item.type === 'CREDIT'
          return (
            <View className="flex-row items-center px-4 py-3 border-b border-border">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  isCredit ? 'bg-success-light' : 'bg-destructive/10'
                }`}
              >
                {isCredit ? (
                  <ArrowDownLeft size={16} color={colors.success.DEFAULT} />
                ) : (
                  <ArrowUpRight size={16} color={colors.destructive.DEFAULT} />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-sans-medium text-foreground">
                  {item.description || item.type}
                </Text>
                <Text className="text-xs text-muted">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </Text>
              </View>
              <Text
                className={`text-base font-sans-semibold ${
                  isCredit ? 'text-success' : 'text-foreground'
                }`}
              >
                {isCredit ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
              </Text>
            </View>
          )
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
        ListEmptyComponent={
          txQuery.isLoading ? (
            <LoadingSpinner fullScreen />
          ) : (
            <EmptyState
              icon={<WalletIcon size={40} color={colors.muted} />}
              title="No transactions yet"
              description="Contributions you receive will appear here"
            />
          )
        }
      />
    </SafeAreaView>
  )
}
