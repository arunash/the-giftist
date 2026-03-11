import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { apiPost } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ArrowLeft } from 'lucide-react-native'
import { colors } from '@/constants/colors'

const CODE_LENGTH = 6

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const { loginWithPhone } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      handleVerify()
    }
  }, [code])

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH || loading) return

    try {
      setLoading(true)
      await loginWithPhone(phone!, code)
      haptic.success()
      router.replace('/(tabs)')
    } catch (e: any) {
      haptic.error()
      Alert.alert('Error', e.message || 'Verification failed')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      await apiPost('/api/auth/send-code', { phone })
      haptic.success()
      setResendTimer(60)
      Alert.alert('Code sent', 'A new verification code has been sent.')
    } catch (e: any) {
      haptic.error()
      Alert.alert('Error', e.message || 'Failed to resend code')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 px-6 pt-16">
        {/* Back Button */}
        <Pressable onPress={() => router.back()} className="mb-8">
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>

        <Text className="text-2xl font-sans-bold text-foreground mb-2">
          Enter verification code
        </Text>
        <Text className="text-base text-muted mb-8">
          We sent a code to {phone}
        </Text>

        {/* Code Input */}
        <View className="flex-row justify-center gap-3 mb-8">
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <View
              key={i}
              className={`w-12 h-14 rounded-xl border-2 items-center justify-center ${
                i < code.length ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <Text className="text-2xl font-sans-bold text-foreground">
                {code[i] || ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Hidden input for keyboard */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          style={{ position: 'absolute', opacity: 0 }}
        />

        {loading && (
          <View className="items-center mb-6">
            <LoadingSpinner />
          </View>
        )}

        {/* Resend */}
        <View className="items-center">
          {resendTimer > 0 ? (
            <Text className="text-sm text-muted">
              Resend code in {resendTimer}s
            </Text>
          ) : (
            <HapticButton onPress={handleResend}>
              <Text className="text-sm font-sans-semibold text-primary">
                Resend code
              </Text>
            </HapticButton>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
