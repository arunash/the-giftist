import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatPrice, daysUntil, getProgressPercentage } from '@/lib/utils'
import { Gift, Calendar, ArrowLeft, Share2, ExternalLink } from 'lucide-react'
import ContributeButton from './ContributeButton'

const eventTypeLabels: Record<string, { label: string; emoji: string }> = {
  BIRTHDAY: { label: 'Birthday', emoji: '🎂' },
  ANNIVERSARY: { label: 'Anniversary', emoji: '💕' },
  WEDDING: { label: 'Wedding', emoji: '💒' },
  BABY_SHOWER: { label: 'Baby Shower', emoji: '👶' },
  CHRISTMAS: { label: 'Christmas', emoji: '🎄' },
  HOLIDAY: { label: 'Holiday', emoji: '🎉' },
  OTHER: { label: 'Event', emoji: '🎁' },
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

  const days = daysUntil(event.date)
  const typeInfo = eventTypeLabels[event.type] || eventTypeLabels.OTHER
  const shareUrl = `https://thegiftist.com/events/${event.shareUrl}`

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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2"
            >
              <Gift className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">The Giftist</span>
            </Link>
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <Share2 className="h-5 w-5" />
              Share
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{typeInfo.emoji}</span>
                <span className="text-sm font-medium text-accent uppercase">
                  {typeInfo.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-secondary mb-1">
                {event.name}
              </h1>
              <p className="text-gray-600">
                by {event.user.name || 'Someone special'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
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
                    ? 'bg-gray-100 text-gray-700'
                    : days <= 7
                    ? 'bg-red-100 text-red-700'
                    : days <= 30
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
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
            <p className="mt-4 text-gray-600 bg-gray-50 p-4 rounded-lg">
              {event.description}
            </p>
          )}

          {/* Overall Progress */}
          <div className="mt-6 p-4 bg-primary-light rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-secondary">
                Total Funded
              </span>
              <span className="text-primary font-semibold">
                {formatPrice(totalFunded)} of {formatPrice(totalGoal)}
              </span>
            </div>
            <div className="h-3 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${getProgressPercentage(totalFunded, totalGoal)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <h2 className="text-xl font-semibold text-secondary mb-4">
          Wishlist Items ({event.items.length})
        </h2>

        {event.items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No items added yet
            </h3>
            <p className="text-gray-600">
              Check back later for wishlist items!
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {event.items.map((eventItem) => (
              <ItemCard
                key={eventItem.item.id}
                item={eventItem.item}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ItemCard({ item }: { item: any }) {
  const goalAmount = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goalAmount)
  const remaining = Math.max(0, goalAmount - item.fundedAmount)
  const isFullyFunded = item.fundedAmount >= goalAmount
  const isPurchased = item.isPurchased

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Image */}
      <div className="relative h-48 bg-gray-100">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift className="h-16 w-16 text-gray-300" />
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
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-secondary line-clamp-2 mb-2">
          {item.name}
        </h3>
        <p className="text-xl font-bold text-primary mb-3">
          {formatPrice(goalAmount)}
        </p>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isFullyFunded ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">
              {formatPrice(item.fundedAmount)} funded
            </span>
            <span className="text-gray-500">{progress}%</span>
          </div>
        </div>

        {/* Contributors */}
        {item.contributions.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">Contributors:</p>
            <div className="flex flex-wrap gap-1">
              {item.contributions.slice(0, 5).map((c: any) => (
                <span
                  key={c.id}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                >
                  {c.isAnonymous
                    ? 'Anonymous'
                    : c.contributor?.name || 'Someone'}{' '}
                  ({formatPrice(c.amount)})
                </span>
              ))}
              {item.contributions.length > 5 && (
                <span className="text-xs text-gray-500">
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
            />
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-900 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
          >
            <ExternalLink className="h-4 w-4" />
            View
          </a>
        </div>
      </div>
    </div>
  )
}
