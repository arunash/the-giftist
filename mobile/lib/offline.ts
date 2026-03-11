import { MMKV } from 'react-native-mmkv'

export const storage = new MMKV({ id: 'giftist-cache' })

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export function cacheGet<T>(key: string): T | null {
  const raw = storage.getString(key)
  if (!raw) return null

  try {
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.timestamp > entry.ttl) {
      storage.delete(key)
      return null
    }
    return entry.data
  } catch {
    storage.delete(key)
    return null
  }
}

export function cacheSet<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl }
  storage.set(key, JSON.stringify(entry))
}

export function cacheClear(): void {
  storage.clearAll()
}

export function cacheDelete(key: string): void {
  storage.delete(key)
}
