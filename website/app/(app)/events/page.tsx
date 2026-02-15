import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { daysUntil } from '@/lib/utils'
import { Plus, Calendar } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default async function EventsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as any).id

  const events = await prisma.event.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
    include: {
      items: { include: { item: true } },
    },
  })

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
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <Link
            href="/events/new"
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition text-sm"
          >
            <Plus className="h-4 w-4" />
            New Event
          </Link>
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-16 w-16" />}
            title="No events yet"
            description="Create an event for your birthday, wedding, or any occasion to start collecting gifts."
            action={
              <Link
                href="/events/new"
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary-hover transition"
              >
                <Plus className="h-4 w-4" />
                Create Event
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const days = daysUntil(event.date)
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block bg-surface rounded-xl p-5 border border-border hover:border-border-light transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-medium text-accent uppercase">
                        {eventTypeLabels[event.type] || 'Event'}
                      </span>
                      <h3 className="font-semibold text-gray-900 mt-1 text-lg">{event.name}</h3>
                      <p className="text-sm text-muted mt-1">
                        {new Date(event.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {event.items.length} item{event.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        days <= 7
                          ? 'bg-red-500/10 text-red-400'
                          : days <= 30
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : days < 0
                          ? 'bg-surface-hover text-muted'
                          : 'bg-green-500/10 text-green-600'
                      }`}
                    >
                      {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : days < 0 ? 'Passed' : `${days} days`}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
