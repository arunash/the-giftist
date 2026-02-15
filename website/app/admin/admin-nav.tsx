'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gift, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/errors', label: 'Errors' },
  { href: '/admin/whatsapp', label: 'WhatsApp' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-surface sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">Giftist Admin</span>
            </div>
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                const isActive =
                  tab.href === '/admin'
                    ? pathname === '/admin'
                    : pathname?.startsWith(tab.href)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:text-gray-900 hover:bg-surface-hover'
                    )}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <Link
            href="/feed"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </div>
    </header>
  )
}
