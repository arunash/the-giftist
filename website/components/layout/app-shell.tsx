'use client'

import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { AmbientPlayer } from './ambient-player'

interface AppShellProps {
  children: React.ReactNode
  walletBalance?: number
}

export function AppShell({ children, walletBalance = 0 }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar walletBalance={walletBalance} />
      <BottomNav />
      <main className="lg:ml-80 pb-20 lg:pb-0 min-h-screen">
        {children}
      </main>
      <AmbientPlayer />
    </div>
  )
}
