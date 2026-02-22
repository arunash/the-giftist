'use client'

import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { NotificationBell } from '@/components/notifications/notification-bell'

interface AppShellProps {
  children: React.ReactNode
  walletBalance?: number
  fundsReceived?: number
}

export function AppShell({ children, walletBalance = 0, fundsReceived = 0 }: AppShellProps) {
  // Sync browser timezone to user profile (once per session)
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && !sessionStorage.getItem('tz_synced')) {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz }),
      })
        .then(() => sessionStorage.setItem('tz_synced', '1'))
        .catch(() => {})
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar walletBalance={walletBalance} fundsReceived={fundsReceived} />
      <BottomNav />
      {/* Mobile header with notification bell */}
      <div className="lg:hidden fixed top-0 right-0 z-40 p-3">
        <NotificationBell />
      </div>
      <main className="lg:ml-80 pb-20 lg:pb-0 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
