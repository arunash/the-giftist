'use client'

import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'

interface AppShellProps {
  children: React.ReactNode
  walletBalance?: number
  fundsReceived?: number
}

export function AppShell({ children, walletBalance = 0, fundsReceived = 0 }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar walletBalance={walletBalance} fundsReceived={fundsReceived} />
      <BottomNav />
      <main className="lg:ml-80 pb-20 lg:pb-0 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
