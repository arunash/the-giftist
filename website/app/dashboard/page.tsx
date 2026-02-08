import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatPrice, daysUntil, getProgressPercentage } from '@/lib/utils'
import {
  Gift,
  Calendar,
  Share2,
  ExternalLink,
  Trash2,
  Plus,
  TrendingDown,
  Settings,
  LogOut,
} from 'lucide-react'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id

  const [user, items, events] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { shareId: true, name: true },
    }),
    prisma.item.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'asc' },
        },
      },
      take: 20,
    }),
    prisma.event.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
      take: 5,
    }),
  ])

  const priceDrops = items.filter((item) => {
    if (!item.priceHistory || item.priceHistory.length < 2) return false
    const current = item.priceValue || 0
    const original = item.priceHistory[0].price
    return current < original
  })

  const shareUrl = `https://thegiftist.com/share/${user?.shareId}`

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2">
              <Gift className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">The Giftist</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Hi, {user?.name || 'there'}!</span>
              <Link
                href="/api/auth/signout"
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Items"
            value={items.length}
            icon={<Gift className="h-5 w-5" />}
          />
          <StatCard
            label="Price Drops"
            value={priceDrops.length}
            icon={<TrendingDown className="h-5 w-5" />}
            highlight
          />
          <StatCard
            label="Events"
            value={events.length}
            icon={<Calendar className="h-5 w-5" />}
          />
          <StatCard
            label="Total Value"
            value={formatPrice(
              items.reduce((sum, item) => sum + (item.priceValue || 0), 0)
            )}
            icon={<Gift className="h-5 w-5" />}
          />
        </div>

        {/* Share Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-secondary">
                Share Your Giftist
              </h2>
              <p className="text-gray-600 text-sm">
                Send this link to friends and family
              </p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition"
            >
              <Share2 className="h-4 w-4" />
              Copy Link
            </button>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <code className="text-sm text-gray-600">{shareUrl}</code>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-secondary">
                Your Items
              </h2>
              <Link
                href="/dashboard/items"
                className="text-primary hover:text-primary-hover font-medium text-sm"
              >
                View All
              </Link>
            </div>

            {items.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
                <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No items yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Install the Chrome extension to start adding items
                </p>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition"
                >
                  <Plus className="h-4 w-4" />
                  Get Extension
                </a>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {items.slice(0, 6).map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Events Sidebar */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-secondary">
                Upcoming Events
              </h2>
              <Link
                href="/events/new"
                className="text-primary hover:text-primary-hover"
              >
                <Plus className="h-5 w-5" />
              </Link>
            </div>

            {events.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 mb-2">No events yet</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Create an event for your birthday, wedding, or any occasion
                </p>
                <Link
                  href="/events/new"
                  className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary-hover transition"
                >
                  <Plus className="h-4 w-4" />
                  Create Event
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight
          ? 'bg-success text-white'
          : 'bg-white border border-gray-100'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-sm ${highlight ? 'text-white/80' : 'text-gray-500'}`}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function ItemCard({ item }: { item: any }) {
  const hasPriceDrop =
    item.priceHistory?.length >= 2 &&
    item.priceValue < item.priceHistory[0].price

  const progress = getProgressPercentage(
    item.fundedAmount,
    item.goalAmount || item.priceValue
  )

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition">
      <div className="relative h-32 bg-gray-100">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {hasPriceDrop && (
          <span className="absolute top-2 left-2 bg-success text-white text-xs font-semibold px-2 py-1 rounded">
            Price Drop!
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-secondary line-clamp-1 mb-1">
          {item.name}
        </h3>
        <p className={`font-bold ${hasPriceDrop ? 'text-success' : 'text-primary'}`}>
          {item.price || 'Price not available'}
        </p>
        {item.fundedAmount > 0 && (
          <div className="mt-2">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formatPrice(item.fundedAmount)} funded of{' '}
              {formatPrice(item.goalAmount || item.priceValue)}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
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

function EventCard({ event }: { event: any }) {
  const days = daysUntil(event.date)
  const eventTypeLabels: Record<string, string> = {
    BIRTHDAY: 'Birthday',
    ANNIVERSARY: 'Anniversary',
    WEDDING: 'Wedding',
    BABY_SHOWER: 'Baby Shower',
    CHRISTMAS: 'Christmas',
    HOLIDAY: 'Holiday',
    OTHER: 'Event',
  }

  return (
    <Link
      href={`/events/${event.id}`}
      className="block bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-accent uppercase">
            {eventTypeLabels[event.type]}
          </span>
          <h3 className="font-semibold text-secondary mt-1">{event.name}</h3>
          <p className="text-sm text-gray-500">
            {new Date(event.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <span
          className={`text-sm font-medium px-2 py-1 rounded ${
            days <= 7
              ? 'bg-red-100 text-red-700'
              : days <= 30
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {days === 0
            ? 'Today!'
            : days === 1
            ? 'Tomorrow'
            : days < 0
            ? 'Passed'
            : `${days} days`}
        </span>
      </div>
      <p className="text-sm text-gray-500 mt-2">
        {event.items.length} item{event.items.length !== 1 ? 's' : ''}
      </p>
    </Link>
  )
}
