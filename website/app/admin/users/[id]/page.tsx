'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Crown,
  Mail,
  Phone,
  User as UserIcon,
} from 'lucide-react'

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    WHATSAPP: 'bg-green-500/20 text-green-400',
    MANUAL: 'bg-blue-500/20 text-blue-400',
    CHAT: 'bg-purple-500/20 text-purple-400',
    EXTENSION: 'bg-orange-500/20 text-orange-400',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[source] || 'bg-gray-500/20 text-gray-400'}`}
    >
      {source}
    </span>
  )
}

function Section({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  count?: number | string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-hover text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted" />
          )}
          <h2 className="font-semibold">{title}</h2>
          {count !== undefined && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  )
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fundedPercent(funded: number, goal: number | null) {
  if (!goal || goal === 0) return '—'
  return `${Math.round((funded / goal) * 100)}%`
}

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'User not found' : 'Failed to load')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading user...</div>
  }
  if (error) {
    return <div className="p-8 text-center text-red-400">{error}</div>
  }

  const { user, items, totalItems, itemsBySource, events, chatMessages, todayChatCount, whatsAppMessages, todayWhatsAppCount, circleMembers, contributionsReceived, activityEvents, lastActive } = data

  const isGold = user.subscription?.status === 'ACTIVE'
  const authProviders = (user.accounts || []).map((a: any) => a.provider)
  let funnelStage = null
  try {
    funnelStage = user.funnelStage ? JSON.parse(user.funnelStage) : null
  } catch {
    funnelStage = user.funnelStage
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/admin/users')}
        className="flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </button>

      {/* 1. User Header */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">
                {user.name || 'Unnamed User'}
              </h1>
              {isGold && (
                <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                  <Crown className="h-3 w-3" /> Gold
                </span>
              )}
              {user.phone && (
                <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                  <Phone className="h-3 w-3" /> Phone
                </span>
              )}
              {authProviders.includes('google') && (
                <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                  <Mail className="h-3 w-3" /> Google
                </span>
              )}
              {!user.isActive && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  Suspended
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted">
              {user.phone && <span>{user.phone}</span>}
              {user.email && <span>{user.email}</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted">
              <span>Joined {formatDate(user.createdAt)}</span>
              <span>Last active {lastActive ? formatDateTime(lastActive) : '—'}</span>
              <span>ID: {user.id}</span>
            </div>
            {funnelStage && (
              <div className="mt-2 text-xs text-muted">
                Funnel:{' '}
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {typeof funnelStage === 'string'
                    ? funnelStage
                    : JSON.stringify(funnelStage)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Profile & Preferences */}
      <Section title="Profile & Preferences" defaultOpen>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Birthday" value={formatDate(user.birthday)} />
          <Field label="Gender" value={user.gender} />
          <Field label="Age Range" value={user.ageRange} />
          <Field label="Interests" value={user.interests} />
          <Field label="Gift Budget" value={user.giftBudget} />
          <Field label="Relationship" value={user.relationship} />
          <Field label="Timezone" value={user.timezone} />
          <Field label="Payout Method" value={user.preferredPayoutMethod} />
          <Field label="Venmo" value={user.venmoHandle} />
          <Field label="PayPal" value={user.paypalEmail} />
          <Field
            label="Stripe Connect"
            value={
              user.stripeConnectAccountId
                ? `${user.stripeConnectOnboarded ? 'Onboarded' : 'Not onboarded'}`
                : null
            }
          />
          <Field
            label="Payout Setup"
            value={user.payoutSetupComplete ? 'Complete' : 'Incomplete'}
          />
        </div>
      </Section>

      {/* 3. Items */}
      <Section
        title="Items"
        count={`${totalItems} total`}
        defaultOpen
      >
        <div className="p-4">
          {Object.keys(itemsBySource).length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {Object.entries(itemsBySource).map(([src, count]) => (
                <span
                  key={src}
                  className="text-xs text-muted bg-surface-hover px-2 py-1 rounded"
                >
                  {src}: {count as number}
                </span>
              ))}
            </div>
          )}
          {items.length === 0 ? (
            <p className="text-muted text-sm">No items.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted border-b border-border">
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Source</th>
                    <th className="text-left p-2 font-medium">Price</th>
                    <th className="text-left p-2 font-medium">Category</th>
                    <th className="text-left p-2 font-medium">Funded</th>
                    <th className="text-left p-2 font-medium">Domain</th>
                    <th className="text-left p-2 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50"
                    >
                      <td className="p-2 font-medium max-w-[200px] truncate">
                        {item.name}
                      </td>
                      <td className="p-2">
                        <SourceBadge source={item.source} />
                      </td>
                      <td className="p-2 text-muted">
                        {item.price || '—'}
                      </td>
                      <td className="p-2 text-muted">
                        {item.category || '—'}
                      </td>
                      <td className="p-2 text-muted">
                        {fundedPercent(item.fundedAmount, item.goalAmount)}
                      </td>
                      <td className="p-2 text-muted text-xs">
                        {item.domain}
                      </td>
                      <td className="p-2 text-muted text-xs">
                        {formatDate(item.addedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalItems > 50 && (
                <p className="text-xs text-muted mt-2">
                  Showing 50 of {totalItems} items
                </p>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* 4. Events */}
      <Section title="Events" count={events.length}>
        <div className="p-4">
          {events.length === 0 ? (
            <p className="text-muted text-sm">No events.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted border-b border-border">
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Type</th>
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Countdown</th>
                    <th className="text-left p-2 font-medium">Items</th>
                    <th className="text-left p-2 font-medium">Funded</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event: any) => {
                    const daysAway = Math.ceil(
                      (new Date(event.date).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                    return (
                      <tr
                        key={event.id}
                        className="border-b border-border/50"
                      >
                        <td className="p-2 font-medium">{event.name}</td>
                        <td className="p-2 text-muted">{event.type}</td>
                        <td className="p-2 text-muted">
                          {formatDate(event.date)}
                        </td>
                        <td className="p-2">
                          {daysAway > 0 ? (
                            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                              {daysAway}d away
                            </span>
                          ) : daysAway === 0 ? (
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
                              Today
                            </span>
                          ) : (
                            <span className="text-xs text-muted">
                              {Math.abs(daysAway)}d ago
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-muted">
                          {event._count.items}
                        </td>
                        <td className="p-2 text-muted">
                          ${event.fundedAmount.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* 5. Chat History */}
      <Section
        title="Chat History"
        count={`${chatMessages.length}${todayChatCount ? ` (${todayChatCount} today)` : ''}`}
      >
        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
          {chatMessages.length === 0 ? (
            <p className="text-muted text-sm">No messages.</p>
          ) : (
            chatMessages.map((msg: any) => (
              <div
                key={msg.id}
                className={`p-2 rounded text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary/5 border-l-2 border-primary'
                    : 'bg-surface-hover border-l-2 border-muted'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      msg.role === 'user' ? 'text-primary' : 'text-muted'
                    }`}
                  >
                    {msg.role === 'user' ? 'USER' : 'ASSISTANT'}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDateTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-muted whitespace-pre-wrap break-words line-clamp-4">
                  {msg.content}
                </p>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* 6. WhatsApp Messages */}
      <Section
        title="WhatsApp Messages"
        count={`${whatsAppMessages.length}${todayWhatsAppCount ? ` (${todayWhatsAppCount} today)` : ''}`}
      >
        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
          {whatsAppMessages.length === 0 ? (
            <p className="text-muted text-sm">No WhatsApp messages.</p>
          ) : (
            whatsAppMessages.map((msg: any) => (
              <div
                key={msg.id}
                className={`p-2 rounded text-sm ${
                  msg.type === 'INBOUND'
                    ? 'bg-green-500/5 border-l-2 border-green-500'
                    : 'bg-surface-hover border-l-2 border-muted'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      msg.type === 'INBOUND'
                        ? 'text-green-400'
                        : 'text-muted'
                    }`}
                  >
                    {msg.type}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDateTime(msg.createdAt)}
                  </span>
                  {msg.status !== 'RECEIVED' && (
                    <span className="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">
                      {msg.status}
                    </span>
                  )}
                </div>
                <p className="text-muted whitespace-pre-wrap break-words line-clamp-3">
                  {msg.content || '(no content)'}
                </p>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* 7. Gift Circle */}
      <Section title="Gift Circle" count={circleMembers.length}>
        <div className="p-4">
          {circleMembers.length === 0 ? (
            <p className="text-muted text-sm">No circle members.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-border">
                  <th className="text-left p-2 font-medium">Name</th>
                  <th className="text-left p-2 font-medium">Phone</th>
                  <th className="text-left p-2 font-medium">Relationship</th>
                </tr>
              </thead>
              <tbody>
                {circleMembers.map((m: any) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="p-2 font-medium">{m.name || '—'}</td>
                    <td className="p-2 text-muted">{m.phone}</td>
                    <td className="p-2 text-muted">
                      {m.relationship || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* 8. Wallet & Contributions */}
      <Section
        title="Wallet & Contributions"
        count={`$${user.wallet?.balance?.toFixed(2) || '0.00'} balance`}
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Stat
              label="Balance"
              value={`$${user.wallet?.balance?.toFixed(2) || '0.00'}`}
            />
            <Stat
              label="Lifetime Received"
              value={`$${user.lifetimeContributionsReceived.toFixed(2)}`}
            />
            <Stat
              label="Contributions Received"
              value={user.contributionsReceivedCount}
            />
          </div>

          {user.wallet?.transactions?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">
                Recent Transactions
              </h3>
              <div className="space-y-1">
                {user.wallet.transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-sm p-2 bg-surface-hover rounded"
                  >
                    <div>
                      <span className="font-medium">{tx.type}</span>
                      {tx.description && (
                        <span className="text-muted ml-2 text-xs">
                          {tx.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                        }
                      >
                        {tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted">
                        {formatDate(tx.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contributionsReceived.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">
                Recent Contributions Received
              </h3>
              <div className="space-y-1">
                {contributionsReceived.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm p-2 bg-surface-hover rounded"
                  >
                    <div>
                      <span className="font-medium">
                        ${c.amount.toFixed(2)}
                      </span>
                      <span className="text-muted ml-2 text-xs">
                        for {c.item?.name || 'unknown item'}
                      </span>
                      {c.message && (
                        <span className="text-muted ml-1 text-xs italic">
                          &quot;{c.message}&quot;
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          c.status === 'COMPLETED'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {c.status}
                      </span>
                      <span className="text-xs text-muted">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 9. Subscription */}
      <Section title="Subscription" count={isGold ? 'Active' : 'Free'}>
        <div className="p-4">
          {user.subscription ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Field label="Status" value={user.subscription.status} />
              <Field
                label="Stripe Customer"
                value={user.subscription.stripeCustomerId}
              />
              <Field
                label="Subscription ID"
                value={user.subscription.stripeSubscriptionId}
              />
              <Field
                label="Price ID"
                value={user.subscription.stripePriceId}
              />
              <Field
                label="Period End"
                value={formatDate(user.subscription.currentPeriodEnd)}
              />
              <Field
                label="Created"
                value={formatDate(user.subscription.createdAt)}
              />
            </div>
          ) : (
            <p className="text-muted text-sm">No subscription (Free tier).</p>
          )}
        </div>
      </Section>
    </div>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium text-sm mt-0.5 break-all">
        {value || '—'}
      </dd>
    </div>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-surface-hover rounded-lg p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
