'use client'

import { formatPrice } from '@/lib/utils'
import { Wallet } from 'lucide-react'

interface BalanceCardProps {
  balance: number
}

export function BalanceCard({ balance }: BalanceCardProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-6 text-white">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="h-5 w-5 text-white/80" />
        <span className="text-sm text-white/80">Funds Balance</span>
      </div>
      <p className="text-4xl font-bold tracking-tight">{formatPrice(balance)}</p>
    </div>
  )
}
