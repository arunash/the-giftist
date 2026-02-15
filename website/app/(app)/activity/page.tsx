'use client'

import { useEffect, useState, useCallback } from 'react'
import { ActivityTabs } from '@/components/activity/activity-tabs'
import { ActivityItem } from '@/components/activity/activity-item'
import { EmptyState } from '@/components/ui/empty-state'
import { Activity } from 'lucide-react'

export default function ActivityPage() {
  const [tab, setTab] = useState<'mine' | 'community'>('mine')
  const [activities, setActivities] = useState<any[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchActivities = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      setActivities([])
      setCursor(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({ tab, limit: '20' })
      if (!reset && cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/activity?${params}`)
      const data = await res.json()

      if (reset) {
        setActivities(data.items || [])
      } else {
        setActivities((prev) => [...prev, ...(data.items || [])])
      }
      setCursor(data.nextCursor)
    } catch (error) {
      console.error('Error fetching activity:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [tab, cursor])

  useEffect(() => {
    fetchActivities(true)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-secondary">Activity</h1>

        <ActivityTabs activeTab={tab} onTabChange={setTab} />

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 bg-surface-hover rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-hover rounded w-3/4" />
                  <div className="h-3 bg-surface-hover rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-16 w-16" />}
            title={tab === 'mine' ? 'No activity yet' : 'No community activity'}
            description={
              tab === 'mine'
                ? 'Your activity will show up here as you add items, fund gifts, and create events.'
                : 'Community activity like public contributions will appear here.'
            }
          />
        ) : (
          <div className="bg-surface rounded-xl border border-border p-4">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
            {cursor && (
              <button
                onClick={() => fetchActivities(false)}
                disabled={loadingMore}
                className="w-full mt-4 py-2 text-sm text-primary font-medium hover:bg-primary/5 rounded-lg transition"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
