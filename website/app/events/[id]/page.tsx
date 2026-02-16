import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatPrice, daysUntil, getProgressPercentage } from '@/lib/utils'
import { applyAffiliateTag } from '@/lib/affiliate'
import { Gift, Calendar, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import ContributeButton from './ContributeButton'
import EventContributeButton from './EventContributeButton'
import AllocateFundsPanel from './AllocateFundsPanel'
import ShareItemButton from './ShareItemButton'
import ShareEventButton from './ShareEventButton'
import EventOwnerActions from './EventOwnerActions'

const eventTypeLabels: Record<string, { label: string; emoji: string }> = {
  BIRTHDAY: { label: 'Birthday', emoji: '🎂' },
  ANNIVERSARY: { label: 'Anniversary', emoji: '💕' },
  WEDDING: { label: 'Wedding', emoji: '💒' },
  BABY_SHOWER: { label: 'Baby Shower', emoji: '👶' },
  CHRISTMAS: { label: 'Christmas', emoji: '🎄' },
  HOLIDAY: { label: 'Holiday', emoji: '🎉' },
  OTHER: { label: 'Event', emoji: '🎁' },
}

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const event = await prisma.event.findFirst({
    where: { OR: [{ shareUrl: params.id }, { id: params.id }] },
    select: { name: true, type: true, description: true, user: { select: { name: true } } },
  })

  if (!event) return { title: 'Event Not Found' }

  const typeInfo = eventTypeLabels[event.type] || eventTypeLabels.OTHER
  const title = `${event.name} - ${typeInfo.label}`
  const description = event.description || `${event.user.name || 'Someone'}'s ${typeInfo.label.toLowerCase()} wishlist on The Giftist`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function EventPage({
  params,
}: {
  params: { id: string }
}) {
  // Try to find by shareUrl first (for public access), then by id
  let event = await prisma.event.findUnique({
    where: { shareUrl: params.id },
    include: {
      user: {
        select: { name: true },
      },
      items: {
        include: {
          item: {
            include: {
              contributions: {
                where: { status: 'COMPLETED' },
                include: {
                  contributor: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { priority: 'asc' },
      },
    },
  })

  if (!event) {
    event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { name: true },
        },
        items: {
          include: {
            item: {
              include: {
                contributions: {
                  where: { status: 'COMPLETED' },
                  include: {
                    contributor: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    })
  }

  if (!event) {
    notFound()
  }

  const session = await getServerSession(authOptions)
  const isOwner = (session?.user as any)?.id === event.userId

  const days = daysUntil(event.date)
  const typeInfo = eventTypeLabels[event.type] || eventTypeLabels.OTHER
  const shareUrl = `https://giftist.ai/events/${event.shareUrl}`

  const totalGoal = event.items.reduce(
    (sum, ei) => sum + (ei.item.goalAmount || ei.item.priceValue || 0),
    0
  )
  const totalFunded = event.items.reduce(
    (sum, ei) => sum + ei.item.fundedAmount,
    0
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2"
            >
              <Image src="/logo-light.png" alt="Giftist" width={34} height={34} className="rounded-lg" />
              <span className="text-xl font-bold text-primary">The Giftist</span>
            </Link>
            <ShareEventButton shareUrl={shareUrl} eventName={event.name} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Header */}
        <div className="bg-surface rounded-xl border border-border p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{typeInfo.emoji}</span>
                <span className="text-sm font-medium text-accent uppercase">
                  {typeInfo.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {event.name}
              </h1>
              <p className="text-muted">
                by {event.user.name || 'Someone special'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">
                {new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <span
                className={`inline-block mt-2 text-sm font-semibold px-3 py-1 rounded-full ${
                  days <= 0
                    ? 'bg-surface-hover text-muted'
                    : days <= 7
                    ? 'bg-red-500/10 text-red-400'
                    : days <= 30
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-green-500/10 text-green-600'
                }`}
              >
                {days === 0
                  ? "It's today!"
                  : days === 1
                  ? 'Tomorrow!'
                  : days < 0
                  ? 'Event passed'
                  : `${days} days to go`}
              </span>
            </div>
          </div>

          {event.description && (
            <p className="mt-4 text-secondary bg-surface-hover p-4 rounded-lg">
              {event.description}
            </p>
          )}

          {/* Owner Actions */}
          {isOwner && (
            <EventOwnerActions eventId={event.id} eventName={event.name} />
          )}

          {/* Overall Progress */}
          <div className="mt-6 p-4 bg-primary-light rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-900">
                Total Funded
              </span>
              <span className="text-primary font-semibold">
                {formatPrice(totalFunded)} of {formatPrice(totalGoal)}
              </span>
            </div>
            <div className="h-3 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${getProgressPercentage(totalFunded, totalGoal)}%`,
                }}
              />
            </div>
          </div>

          {/* Event-level contribute button */}
          <div className="mt-5">
            <EventContributeButton
              eventId={event.id}
              eventName={event.name}
              ownerName={event.user.name || 'Someone'}
            />
          </div>
        </div>

        {/* Fund Allocation (owner only) */}
        {isOwner && (
          <AllocateFundsPanel
            eventId={event.id}
            fundedAmount={event.fundedAmount}
            items={event.items.map((ei) => ({
              id: ei.item.id,
              name: ei.item.name,
              image: ei.item.image,
              fundedAmount: ei.item.fundedAmount,
              goalAmount: ei.item.goalAmount,
              priceValue: ei.item.priceValue,
            }))}
          />
        )}

        {/* Items Grid */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Wishlist Items ({event.items.length})
        </h2>

        {event.items.length === 0 ? (
          <div className="bg-surface rounded-xl p-12 text-center border border-border">
            <Gift className="h-16 w-16 text-[#333] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No items added yet
            </h3>
            <p className="text-muted">
              Check back later for wishlist items!
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {event.items.map((eventItem) => (
              <ItemCard
                key={eventItem.item.id}
                item={eventItem.item}
                ownerName={event.user.name || 'Someone'}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ItemCard({ item, ownerName }: { item: any; ownerName: string }) {
  const goalAmount = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goalAmount)
  const remaining = Math.max(0, goalAmount - item.fundedAmount)
  const isFullyFunded = item.fundedAmount >= goalAmount
  const isPurchased = item.isPurchased
  const affiliateUrl = applyAffiliateTag(item.url)

  return (
    <div className="bg-surface rounded-xl overflow-hidden border border-border">
      {/* Image */}
      <a href={affiliateUrl} target="_blank" rel="noopener noreferrer" className="block relative h-48 bg-surface-hover">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift className="h-16 w-16 text-[#333]" />
          </div>
        )}
        {isPurchased && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-success text-white px-4 py-2 rounded-lg font-semibold">
              Purchased!
            </span>
          </div>
        )}
        {!isPurchased && isFullyFunded && (
          <div className="absolute top-3 right-3 bg-success text-white px-3 py-1 rounded-full text-sm font-semibold">
            Fully Funded!
          </div>
        )}
      </a>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
          {item.name}
        </h3>
        <p className="text-xl font-bold text-primary mb-3">
          {formatPrice(goalAmount)}
        </p>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isFullyFunded ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">
              {formatPrice(item.fundedAmount)} funded
            </span>
            <span className="text-muted">{progress}%</span>
          </div>
        </div>

        {/* Contributors */}
        {item.contributions.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted mb-1">Contributors:</p>
            <div className="flex flex-wrap gap-1">
              {item.contributions.slice(0, 5).map((c: any) => (
                <span
                  key={c.id}
                  className="text-xs bg-surface-hover text-muted px-2 py-1 rounded"
                >
                  {c.isAnonymous
                    ? 'Anonymous'
                    : c.contributor?.name || 'Someone'}{' '}
                  ({formatPrice(c.amount)})
                </span>
              ))}
              {item.contributions.length > 5 && (
                <span className="text-xs text-muted">
                  +{item.contributions.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isPurchased && !isFullyFunded && (
            <ContributeButton
              itemId={item.id}
              itemName={item.name}
              remaining={remaining}
              ownerName={ownerName}
            />
          )}
          <ShareItemButton itemId={item.id} ownerName={ownerName} />
        </div>
      </div>
    </div>
  )
}
