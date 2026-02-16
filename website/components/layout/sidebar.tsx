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
  LogOut,
  Crown,
  ArrowUpRight,
  Gift,
  Sparkles,
  Users,
} from 'lucide-react'
import Image from 'next/image'
import { cn, formatPrice } from '@/lib/utils'
import { SidebarSummary } from './sidebar-summary'

const navItems = [
  { href: '/feed', label: 'Home', icon: LayoutGrid },
  { href: '/chat', label: 'Concierge', icon: MessageCircle },
  { href: '/circle', label: 'Circle', icon: Users },
  { href: '/wallet', label: 'Funds', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  walletBalance?: number
  fundsReceived?: number
}

export function Sidebar({ walletBalance = 0, fundsReceived = 0 }: SidebarProps) {
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
        <Link href="/feed" className="flex items-center gap-2.5">
          <Image src="/logo-light.png" alt="Giftist" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold text-primary">The Giftist</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const showBadge = item.href === '/wallet' && fundsReceived > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-surface-hover hover:text-gray-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {showBadge && (
                <span className="ml-auto text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-full leading-none">
                  {formatPrice(fundsReceived)}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* AI Summary — scrollable middle section */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarSummary />
      </div>

      {/* Funds cards */}
      <div className="mx-4 mb-4 space-y-2">
        <a href="/wallet" className="group relative block p-4 rounded-xl bg-white border border-gray-200 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer overflow-hidden">
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Your Funds</p>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(walletBalance)}</p>
          {walletBalance > 0 && (
            <p className="text-[11px] text-primary font-medium mt-1 flex items-center gap-0.5">
              Ready to send <ArrowUpRight className="h-3 w-3" />
            </p>
          )}
        </a>
        {fundsReceived > 0 && (
          <a href="/wallet" className="group relative block p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer overflow-hidden">
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Gift className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Gifted to you</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{formatPrice(fundsReceived)}</p>
            <p className="text-[11px] text-emerald-600/70 mt-1">from friends & family</p>
          </a>
        )}
      </div>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-900 truncate">
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
            className="text-muted hover:text-gray-900 p-1 transition"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
