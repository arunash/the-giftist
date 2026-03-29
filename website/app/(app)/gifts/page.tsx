'use client'

import { useEffect, useState } from 'react'
import { Gift, Send, ArrowDown, ExternalLink, Package, Truck, Check, Clock, MessageCircle } from 'lucide-react'
import Link from 'next/link'

interface GiftItem {
  id: string
  itemName: string
  itemImage: string | null
  itemUrl: string | null
  amount: number
  status: string
  recipientName?: string
  recipientPhone?: string
  senderName?: string
  senderMessage: string | null
  redeemCode: string
  createdAt: string
  redeemedAt: string | null
  shippedAt: string | null
  trackingUrl: string | null
  direction: 'sent' | 'received'
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  PAID: { label: 'Paid', icon: Check, color: 'text-blue-400 bg-blue-500/10' },
  NOTIFIED: { label: 'Sent', icon: Send, color: 'text-primary bg-primary/10' },
  REDEEMED: { label: 'Redeemed', icon: Gift, color: 'text-green-400 bg-green-500/10' },
  REDEEMED_PENDING_SHIPMENT: { label: 'Shipping', icon: Package, color: 'text-amber-400 bg-amber-500/10' },
  SHIPPED: { label: 'Shipped', icon: Truck, color: 'text-blue-400 bg-blue-500/10' },
  DELIVERED: { label: 'Delivered', icon: Check, color: 'text-green-400 bg-green-500/10' },
  PENDING: { label: 'Pending', icon: Clock, color: 'text-gray-400 bg-gray-500/10' },
}

function GiftCard({ gift }: { gift: GiftItem }) {
  const status = STATUS_CONFIG[gift.status] || STATUS_CONFIG.PENDING
  const StatusIcon = status.icon

  return (
    <div className="bg-surface rounded-xl border border-border p-4 hover:border-border/80 transition">
      <div className="flex gap-3">
        {gift.itemImage ? (
          <img src={gift.itemImage} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
            <Gift className="h-6 w-6 text-primary/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{gift.itemName}</p>
              <p className="text-xs text-muted mt-0.5">
                {gift.direction === 'sent'
                  ? `To ${gift.recipientName || gift.recipientPhone || 'someone'}`
                  : `From ${gift.senderName || 'someone'}`
                }
              </p>
            </div>
            <p className="text-sm font-semibold whitespace-nowrap">${gift.amount.toFixed(2)}</p>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
              <StatusIcon className="h-2.5 w-2.5" />
              {status.label}
            </span>
            <span className="text-[10px] text-muted">
              {new Date(gift.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {gift.senderMessage && (
            <p className="text-xs text-muted mt-2 italic">"{gift.senderMessage}"</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {gift.direction === 'received' && !gift.redeemedAt && (
              <Link
                href={`/gift/${gift.redeemCode}`}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
              >
                <Gift className="h-3 w-3" /> Redeem
              </Link>
            )}
            {gift.trackingUrl && (
              <a
                href={gift.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
              >
                <Truck className="h-3 w-3" /> Track
              </a>
            )}
            {gift.itemUrl && (
              <a
                href={gift.itemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted hover:underline flex items-center gap-0.5"
              >
                <ExternalLink className="h-3 w-3" /> View item
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GiftsPage() {
  const [tab, setTab] = useState<'sent' | 'received'>('sent')
  const [sent, setSent] = useState<GiftItem[]>([])
  const [received, setReceived] = useState<GiftItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gifts')
      .then(r => r.json())
      .then(data => {
        setSent(data.sent || [])
        setReceived(data.received || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const gifts = tab === 'sent' ? sent : received

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gifts</h1>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition"
        >
          <MessageCircle className="h-4 w-4" />
          Send a gift
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit mb-6">
        <button
          onClick={() => setTab('sent')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            tab === 'sent' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          Sent
          {sent.length > 0 && <span className="ml-1 text-[10px] text-muted">{sent.length}</span>}
        </button>
        <button
          onClick={() => setTab('received')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            tab === 'received' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Received
          {received.length > 0 && <span className="ml-1 text-[10px] text-muted">{received.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : gifts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-primary/30" />
          </div>
          <p className="text-lg font-medium text-foreground mb-1">
            {tab === 'sent' ? 'No gifts sent yet' : 'No gifts received yet'}
          </p>
          <p className="text-sm text-muted mb-6">
            {tab === 'sent'
              ? 'Ask the concierge for gift ideas and send one to someone special.'
              : 'When someone sends you a gift, it will show up here.'
            }
          </p>
          {tab === 'sent' && (
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition"
            >
              <MessageCircle className="h-4 w-4" />
              Find a gift to send
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {gifts.map(gift => (
            <GiftCard key={gift.id} gift={gift} />
          ))}
        </div>
      )}
    </div>
  )
}
