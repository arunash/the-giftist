import { useState } from 'react'
import { View, Text, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { pickImage, capturePhoto, scanImageForProduct } from '@/lib/image-scanner'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import { Image } from 'expo-image'
import { X, Camera, ImageIcon, Sparkles } from 'lucide-react-native'

export default function ScanScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const queryClient = useQueryClient()

  const handleCapture = async () => {
    const uri = await capturePhoto()
    if (uri) {
      setImageUri(uri)
      await processScan(uri)
    }
  }

  const handlePick = async () => {
    const uri = await pickImage()
    if (uri) {
      setImageUri(uri)
      await processScan(uri)
    }
  }

  const processScan = async (uri: string) => {
    try {
      setScanning(true)
      const item = await scanImageForProduct(uri)
      haptic.success()
      queryClient.invalidateQueries({ queryKey: ['items'] })
      Alert.alert(
        'Item Added!',
        `"${item.name}" has been added to your wishlist.`,
        [{ text: 'View', onPress: () => router.replace(`/items/${item.id}`) }]
      )
    } catch (e: any) {
      haptic.error()
      Alert.alert('Scan Failed', e.message || 'Could not identify the product. Try again with a clearer image.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <HapticButton onPress={() => router.back()}>
          <X size={24} color={colors.foreground} />
        </HapticButton>
        <Text className="text-xl font-sans-bold text-foreground ml-3">Scan Product</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {scanning ? (
          <View className="items-center">
            <Sparkles size={48} color={colors.primary.DEFAULT} />
            <Text className="text-lg font-sans-semibold text-foreground mt-4">
              Analyzing image...
            </Text>
            <Text className="text-sm text-muted mt-1">Our AI is identifying the product</Text>
            <LoadingSpinner />
          </View>
        ) : imageUri ? (
          <View className="items-center">
            <Image
              source={{ uri: imageUri }}
              style={{ width: 280, height: 280, borderRadius: 20 }}
              contentFit="cover"
            />
          </View>
        ) : (
          <>
            <View className="w-20 h-20 rounded-3xl bg-primary/10 items-center justify-center mb-6">
              <Camera size={40} color={colors.primary.DEFAULT} />
            </View>
            <Text className="text-xl font-sans-bold text-foreground text-center mb-2">
              Scan a product
            </Text>
            <Text className="text-sm text-muted text-center mb-10">
              Take a photo or choose from your gallery and our AI will identify it and add it to your wishlist
            </Text>

            <View className="w-full gap-3">
              <HapticButton
                onPress={handleCapture}
                hapticType="medium"
                className="bg-primary rounded-2xl py-4 flex-row items-center justify-center"
              >
                <Camera size={20} color="#fff" />
                <Text className="text-base font-sans-semibold text-white ml-2">
                  Take Photo
                </Text>
              </HapticButton>

              <HapticButton
                onPress={handlePick}
                hapticType="medium"
                className="bg-card border border-border rounded-2xl py-4 flex-row items-center justify-center"
              >
                <ImageIcon size={20} color={colors.foreground} />
                <Text className="text-base font-sans-semibold text-foreground ml-2">
                  Choose from Gallery
                </Text>
              </HapticButton>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}
