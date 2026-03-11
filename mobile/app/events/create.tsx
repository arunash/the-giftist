import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import { X } from 'lucide-react-native'

const EVENT_TYPES = ['Birthday', 'Holiday', 'Anniversary', 'Wedding', 'Baby Shower', 'Graduation', 'Other']

export default function CreateEventScreen() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState('Birthday')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/events', { name, type, date, description: description || undefined }),
    onSuccess: () => {
      haptic.success()
      queryClient.invalidateQueries({ queryKey: ['events'] })
      router.back()
    },
    onError: (err: any) => {
      haptic.error()
      Alert.alert('Error', err.message || 'Failed to create event')
    },
  })

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <HapticButton onPress={() => router.back()}>
            <X size={24} color={colors.foreground} />
          </HapticButton>
          <Text className="text-lg font-sans-semibold text-foreground">New Event</Text>
          <HapticButton
            onPress={() => mutation.mutate()}
            disabled={!name || !date || mutation.isPending}
          >
            {mutation.isPending ? (
              <LoadingSpinner size="small" />
            ) : (
              <Text className={`text-base font-sans-semibold ${name && date ? 'text-primary' : 'text-muted'}`}>
                Save
              </Text>
            )}
          </HapticButton>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Name */}
          <Text className="text-sm font-sans-medium text-foreground mb-1.5">Event Name</Text>
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground font-sans mb-4"
            placeholder="e.g., Mom's Birthday"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />

          {/* Type */}
          <Text className="text-sm font-sans-medium text-foreground mb-1.5">Type</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {EVENT_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  haptic.selection()
                  setType(t)
                }}
                className={`px-4 py-2 rounded-full border ${
                  type === t
                    ? 'bg-primary border-primary'
                    : 'bg-card border-border'
                }`}
              >
                <Text
                  className={`text-sm font-sans-medium ${
                    type === t ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Date */}
          <Text className="text-sm font-sans-medium text-foreground mb-1.5">Date</Text>
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground font-sans mb-4"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            value={date}
            onChangeText={setDate}
            keyboardType="numbers-and-punctuation"
          />

          {/* Description */}
          <Text className="text-sm font-sans-medium text-foreground mb-1.5">Description (optional)</Text>
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground font-sans mb-4"
            placeholder="Add a note..."
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
