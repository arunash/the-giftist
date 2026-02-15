'use client'

import { cn } from '@/lib/utils'

interface ActivityTabsProps {
  activeTab: 'mine' | 'community'
  onTabChange: (tab: 'mine' | 'community') => void
}

export function ActivityTabs({ activeTab, onTabChange }: ActivityTabsProps) {
  return (
    <div className="flex gap-1 bg-surface-hover rounded-lg p-1">
      <button
        onClick={() => onTabChange('mine')}
        className={cn(
          'flex-1 py-2 text-sm font-medium rounded-md transition',
          activeTab === 'mine'
            ? 'bg-surface text-gray-900'
            : 'text-muted hover:text-gray-900'
        )}
      >
        My Activity
      </button>
      <button
        onClick={() => onTabChange('community')}
        className={cn(
          'flex-1 py-2 text-sm font-medium rounded-md transition',
          activeTab === 'community'
            ? 'bg-surface text-gray-900'
            : 'text-muted hover:text-gray-900'
        )}
      >
        Community
      </button>
    </div>
  )
}
