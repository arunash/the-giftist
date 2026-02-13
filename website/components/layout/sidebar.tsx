'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutGrid,
  Activity,
  MessageCircle,
  Wallet,
  Settings,
  Gift,
  LogOut,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'

const navItems = [
  { href: '/feed', label: 'Feed', icon: LayoutGrid },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  walletBalance?: number
}

export function Sidebar({ walletBalance = 0 }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen fixed left-0 top-0 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/feed" className="flex items-center gap-2">
          <Gift className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold text-primary">The Giftist</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
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
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Wallet balance card */}
      <div className="mx-4 mb-4 p-4 rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white">
        <p className="text-xs text-white/70 mb-1">Wallet Balance</p>
        <p className="text-xl font-bold">{formatPrice(walletBalance)}</p>
      </div>

      {/* User section */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session?.user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {session?.user?.email || ''}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
