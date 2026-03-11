import { create } from 'zustand'
import {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  isAuthenticated,
  type AuthUser,
} from '@/lib/auth'
import { apiPost } from '@/lib/api'
import { registerForPushNotifications } from '@/lib/notifications'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isLoggedIn: boolean
  initialize: () => Promise<void>
  loginWithPhone: (phone: string, code: string) => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
  loginWithApple: (idToken: string, email?: string, fullName?: { givenName?: string; familyName?: string }) => Promise<void>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,

  initialize: async () => {
    try {
      const authed = await isAuthenticated()
      if (authed) {
        const user = await getStoredUser()
        set({ user, isLoggedIn: !!user, isLoading: false })
      } else {
        await clearToken()
        set({ user: null, isLoggedIn: false, isLoading: false })
      }
    } catch {
      set({ user: null, isLoggedIn: false, isLoading: false })
    }
  },

  loginWithPhone: async (phone, code) => {
    const res = await apiPost('/api/auth/mobile-login', { phone, code })
    await setToken(res.token)
    await setStoredUser(res.user)
    set({ user: res.user, isLoggedIn: true })
    registerForPushNotifications().catch(() => {})
  },

  loginWithGoogle: async (idToken) => {
    const res = await apiPost('/api/auth/mobile-login', { googleIdToken: idToken })
    await setToken(res.token)
    await setStoredUser(res.user)
    set({ user: res.user, isLoggedIn: true })
    registerForPushNotifications().catch(() => {})
  },

  loginWithApple: async (idToken, email, fullName) => {
    const res = await apiPost('/api/auth/mobile-login', {
      appleIdToken: idToken,
      email,
      fullName,
    })
    await setToken(res.token)
    await setStoredUser(res.user)
    set({ user: res.user, isLoggedIn: true })
    registerForPushNotifications().catch(() => {})
  },

  logout: async () => {
    await clearToken()
    set({ user: null, isLoggedIn: false })
  },
}))
