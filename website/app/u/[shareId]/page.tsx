import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatPrice, getProgressPercentage } from '@/lib/utils'
import { applyAffiliateTag } from '@/lib/affiliate'
import { Gift } from 'lucide-react'
import ContributeButton from './ContributeButton'
import ShareHeader from './ShareHeader'
import ShareItemButton from './ShareItemButton'
import ViewTracker from './ViewTracker'

export async function generateMetadata({
  params,
}: {
  params: { shareId: string }
}): Promise<Metadata> {
  const user = await prisma.user.findUnique({
    where: { shareId: params.shareId },
    select: { name: true, _count: { select: { items: true } } },
  })

  if (!user) return { title: 'Wishlist Not Found' }

  const name = user.name || 'Someone'
  const title = `${name}'s Wishlist - The Giftist`
  const description = `${name} has ${user._count.items} items on their Giftist wishlist. View and contribute to their gifts!`

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

export default async function SharedWishlistPage({
  params,
}: {
  params: { shareId: string }
}) {
  const user = await prisma.user.findUnique({
    where: { shareId: params.shareId },
    select: {
      name: true,
      shareId: true,
      items: {
        orderBy: { addedAt: 'desc' },
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
  })

  if (!user) {
    notFound()
  }

  const items = user.items
  const totalGoal = items.reduce(
    (sum, item) => sum + (item.goalAmount || item.priceValue || 0),
    0
  )
  const totalFunded = items.reduce(
    (sum, item) => sum + item.fundedAmount,
    0
  )

  return (
    <div className="min-h-screen bg-background">
      <ViewTracker shareId={params.shareId} />
      <ShareHeader shareId={params.shareId} ownerName={user.name || 'Someone'} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Section */}
        <div className="bg-surface rounded-xl border border-border p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">🎁</span>
                <span className="text-sm font-medium text-accent uppercase">
                  Wishlist
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {user.name || 'Someone'}&apos;s Giftist
              </h1>
              <p className="text-muted">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          {/* Overall Progress */}
          {totalGoal > 0 && (
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
          )}
        </div>

        {/* Items Grid */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Wishlist Items ({items.length})
        </h2>

        {items.length === 0 ? (
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
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                shareId={params.shareId}
                ownerName={user.name || 'Someone'}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ItemCard({ item, shareId, ownerName }: { item: any; shareId: string; ownerName: string }) {
  const goalAmount = item.goalAmount || item.priceValue || 0
  const progress = getProgressPercentage(item.fundedAmount, goalAmount)
  const remaining = Math.max(0, goalAmount - item.fundedAmount)
  const isFullyFunded = goalAmount > 0 && item.fundedAmount >= goalAmount
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
          <a href={affiliateUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {item.name}
          </a>
        </h3>
        {goalAmount > 0 && (
          <>
            <p className="text-xl font-bold text-primary">
              {formatPrice(item.priceValue || goalAmount)}
            </p>
            {item.priceValue && item.priceValue > 0 ? (
              item.goalAmount && item.goalAmount > item.priceValue ? (
                <p className="text-xs text-muted mb-3">+ {formatPrice(item.goalAmount - item.priceValue)} fee (3%)</p>
              ) : (
                <p className="text-xs text-muted mb-3">
                  <span className="line-through opacity-60">+ {formatPrice(Math.round(item.priceValue * 0.03 * 100) / 100)} fee</span>{' '}
                  Free on first $50
                </p>
              )
            ) : (
              <div className="mb-3" />
            )}
          </>
        )}

        {/* Progress Bar */}
        {goalAmount > 0 && (
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
        )}

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
          {!isPurchased && !isFullyFunded && goalAmount > 0 && (
            <ContributeButton
              itemId={item.id}
              itemName={item.name}
              remaining={remaining}
              shareId={shareId}
              hasFee={!!(item.goalAmount && item.priceValue && item.goalAmount > item.priceValue)}
            />
          )}
          <ShareItemButton itemId={item.id} ownerName={ownerName} />
        </div>
      </div>
    </div>
  )
}
