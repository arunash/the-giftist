'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutGrid,
  MessageCircle,
  Wallet,
  Settings,
  Gift,
  LogOut,
  Crown,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { SidebarSummary } from './sidebar-summary'

const navItems = [
  { href: '/feed', label: 'Home', icon: LayoutGrid },
  { href: '/chat', label: 'Concierge', icon: MessageCircle },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  walletBalance?: number
}

export function Sidebar({ walletBalance = 0 }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isGold, setIsGold] = useState(false)

  useEffect(() => {
    fetch('/api/subscription')
      .then((r) => r.json())
      .then((data) => setIsGold(data.status === 'ACTIVE'))
      .catch(() => {})
  }, [])

  return (
    <aside className="hidden lg:flex flex-col w-80 h-screen fixed left-0 top-0 bg-surface border-r border-border">
      {/* Logo */}
      <div className="p-6">
        <Link href="/feed" className="flex items-center gap-2">
          <Gift className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold text-primary">The Giftist</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-surface-hover hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* AI Summary — scrollable middle section */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarSummary />
      </div>

      {/* Wallet balance card */}
      <a href="/wallet" className="block mx-4 mb-4 p-4 rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white hover:brightness-110 transition cursor-pointer">
        <p className="text-xs text-white/70 mb-1">Wallet Balance</p>
        <p className="text-xl font-bold">{formatPrice(walletBalance)}</p>
      </a>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-white truncate">
                {session?.user?.name || 'User'}
              </p>
              {isGold && (
                <span title="Gold member"><Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" /></span>
              )}
            </div>
            <p className="text-xs text-muted truncate">
              {session?.user?.email || ''}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-muted hover:text-white p-1 transition"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
