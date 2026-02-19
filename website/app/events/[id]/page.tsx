import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatPrice, daysUntil, getProgressPercentage } from '@/lib/utils'
import { Gift, Calendar, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import EventContributeButton from './EventContributeButton'
import AllocateFundsPanel from './AllocateFundsPanel'
import ShareEventButton from './ShareEventButton'
import EventOwnerActions from './EventOwnerActions'
import EventItemsGrid from './EventItemsGrid'
import EventNotifyCircle from './EventNotifyCircle'
import EventAISuggestions from './EventAISuggestions'

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
  ) + event.fundedAmount

  // Build item names list for AI suggestion prompt
  const itemNames = event.items.map((ei) => ei.item.name)

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

          {/* Notify Circle (owner only) */}
          {isOwner && (
            <EventNotifyCircle
              eventId={event.id}
              circleNotifiedAt={event.circleNotifiedAt?.toISOString() ?? null}
            />
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

        <EventItemsGrid
          items={event.items.map((ei) => ({
            id: ei.item.id,
            name: ei.item.name,
            image: ei.item.image,
            url: ei.item.url,
            priceValue: ei.item.priceValue,
            goalAmount: ei.item.goalAmount,
            fundedAmount: ei.item.fundedAmount,
            isPurchased: ei.item.isPurchased,
            contributions: ei.item.contributions.map((c: any) => ({
              id: c.id,
              amount: c.amount,
              isAnonymous: c.isAnonymous,
              contributor: c.contributor ? { name: c.contributor.name } : null,
            })),
          }))}
          ownerName={event.user.name || 'Someone'}
          isOwner={isOwner}
        />

        {/* AI Suggestion CTA (owner only) */}
        {isOwner && (
          <EventAISuggestions eventName={event.name} itemNames={itemNames} />
        )}
      </main>
    </div>
  )
}
