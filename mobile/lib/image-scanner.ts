import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api, BASE_URL } from './api'
import { getToken } from './auth'
import type { Item } from './types'

export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  })

  if (result.canceled || !result.assets[0]) return null
  return result.assets[0].uri
}

export async function capturePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') return null

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
  })

  if (result.canceled || !result.assets[0]) return null
  return result.assets[0].uri
}

export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  )
  return result.uri
}

export async function scanImageForProduct(uri: string): Promise<Item> {
  const compressed = await compressImage(uri)

  // Create form data with the image
  const formData = new FormData()
  formData.append('image', {
    uri: compressed,
    type: 'image/jpeg',
    name: 'scan.jpg',
  } as any)

  const token = await getToken()
  const res = await fetch(`${BASE_URL}/api/items/from-image`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to scan image')
  }

  return res.json()
}
