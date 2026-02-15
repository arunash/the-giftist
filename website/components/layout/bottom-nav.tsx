'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutGrid,
  MessageCircle,
  Wallet,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/feed', label: 'Home', icon: LayoutGrid },
  { href: '/chat', label: 'Concierge', icon: MessageCircle },
  { href: '/wallet', label: 'Funds', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-lg border-t border-border z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted hover:text-gray-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors text-muted hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px] font-medium">Sign Out</span>
        </button>
      </div>
    </nav>
  )
}
