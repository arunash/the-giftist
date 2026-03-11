import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'giftist_jwt'
const USER_KEY = 'giftist_user'

export interface AuthUser {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  image: string | null
}

let cachedToken: string | null = null

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY)
  return cachedToken
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearToken(): Promise<void> {
  cachedToken = null
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(USER_KEY)
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const json = await SecureStore.getItemAsync(USER_KEY)
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function setStoredUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken()
  if (!token) return false

  // Check if JWT is expired (decode without verification)
  try {
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(atob(payloadB64))
    return payload.exp > Date.now() / 1000
  } catch {
    return false
  }
}
