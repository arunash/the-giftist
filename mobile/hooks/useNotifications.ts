import { useEffect, useRef } from 'react'
import { setupNotificationListeners } from '@/lib/notifications'

export function useNotificationListeners() {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    cleanupRef.current = setupNotificationListeners()
    return () => {
      cleanupRef.current?.()
    }
  }, [])
}
