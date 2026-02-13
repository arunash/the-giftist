'use client'

import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'

interface AppShellProps {
  children: React.ReactNode
  walletBalance?: number
}

export function AppShell({ children, walletBalance = 0 }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar walletBalance={walletBalance} />
      <BottomNav />
      <main className="lg:ml-60 pb-20 lg:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
