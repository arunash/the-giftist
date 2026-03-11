import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { cacheGet, cacheSet } from '@/lib/offline'

/**
 * Persist TanStack Query data to MMKV for offline reads.
 * On mount, hydrates the query cache from MMKV.
 * On query updates, writes to MMKV.
 */
export function useOfflineCache(queryKey: QueryKey, ttl?: number) {
  const queryClient = useQueryClient()
  const cacheKey = `rq:${JSON.stringify(queryKey)}`

  // Hydrate from cache on mount
  useEffect(() => {
    const cached = cacheGet(cacheKey)
    if (cached) {
      queryClient.setQueryData(queryKey, cached)
    }
  }, [cacheKey])

  // Subscribe to query changes and persist
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.query.queryKey.toString() === queryKey.toString() &&
        event.query.state.data
      ) {
        cacheSet(cacheKey, event.query.state.data, ttl)
      }
    })
    return unsubscribe
  }, [cacheKey, queryKey, ttl])
}
