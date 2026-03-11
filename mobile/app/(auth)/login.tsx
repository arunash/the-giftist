import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '@/hooks/useAuth'
import { apiPost } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Crown, Phone, ChevronRight } from 'lucide-react-native'
import { colors } from '@/constants/colors'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginWithGoogle, loginWithApple } = useAuth()

  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  })

  // Handle Google sign-in response
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      const result = await googlePromptAsync()
      if (result.type === 'success' && result.authentication?.idToken) {
        await loginWithGoogle(result.authentication.idToken)
        router.replace('/(tabs)')
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Google sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAppleSignIn = async () => {
    try {
      setLoading(true)
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      })

      if (credential.identityToken) {
        await loginWithApple(
          credential.identityToken,
          credential.email || undefined,
          credential.fullName
            ? {
                givenName: credential.fullName.givenName || undefined,
                familyName: credential.fullName.familyName || undefined,
              }
            : undefined
        )
        router.replace('/(tabs)')
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', e.message || 'Apple sign-in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid phone number')
      return
    }

    try {
      setLoading(true)
      await apiPost('/api/auth/send-code', { phone }, )
      haptic.success()
      router.push({ pathname: '/(auth)/verify', params: { phone } })
    } catch (e: any) {
      haptic.error()
      Alert.alert('Error', e.message || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo & Title */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
            <Crown size={32} color="#fff" />
          </View>
          <Text className="text-3xl font-sans-bold text-foreground">Giftist</Text>
          <Text className="text-base text-muted mt-1">Your AI Gift Concierge</Text>
        </View>

        {/* Phone Input */}
        <View className="mb-4">
          <View className="flex-row items-center bg-card border border-border rounded-xl px-4 py-3">
            <Phone size={20} color={colors.muted} />
            <TextInput
              className="flex-1 ml-3 text-base text-foreground font-sans"
              placeholder="Phone number"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
              editable={!loading}
            />
            <HapticButton onPress={handleSendCode} disabled={loading || phone.length < 10}>
              <View className="bg-primary rounded-lg px-4 py-2">
                {loading ? (
                  <LoadingSpinner size="small" color="#fff" />
                ) : (
                  <ChevronRight size={18} color="#fff" />
                )}
              </View>
            </HapticButton>
          </View>
          <Text className="text-xs text-muted mt-2 ml-1">
            We'll send a verification code via WhatsApp
          </Text>
        </View>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-border" />
          <Text className="mx-4 text-sm text-muted">or</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        {/* Social Login Buttons */}
        <View className="gap-3">
          <HapticButton onPress={handleGoogleSignIn} disabled={loading}>
            <View className="flex-row items-center justify-center bg-card border border-border rounded-xl px-4 py-3.5">
              <Image
                source={require('@/assets/google-icon.png')}
                style={{ width: 20, height: 20 }}
              />
              <Text className="ml-3 text-base font-sans-medium text-foreground">
                Continue with Google
              </Text>
            </View>
          </HapticButton>

          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={{ height: 50 }}
              onPress={handleAppleSignIn}
            />
          )}
        </View>

        {/* Terms */}
        <Text className="text-xs text-muted text-center mt-8">
          By continuing, you agree to our{' '}
          <Text className="text-primary">Terms of Service</Text> and{' '}
          <Text className="text-primary">Privacy Policy</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
