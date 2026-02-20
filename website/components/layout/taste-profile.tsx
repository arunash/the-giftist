'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User } from 'lucide-react'

const PROFILE_FIELDS = ['birthday', 'gender', 'ageRange', 'interests', 'giftBudget', 'relationship'] as const

export function TasteProfile() {
  const [interests, setInterests] = useState<string[]>([])
  const [completion, setCompletion] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        const filled = PROFILE_FIELDS.filter((f) => {
          const val = data[f]
          if (f === 'interests') return Array.isArray(val) && val.length > 0
          return val != null && val !== ''
        })
        setCompletion(Math.round((filled.length / PROFILE_FIELDS.length) * 100))
        if (Array.isArray(data.interests)) setInterests(data.interests)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null

  return (
    <div className="mx-4 mb-4">
      <Link href="/settings" className="block p-3 rounded-xl bg-white border border-gray-200 hover:border-primary/30 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-gray-900">Taste Profile</span>
          </div>
          <span className="text-[10px] font-bold text-primary">{completion}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-primary to-pink-400 rounded-full transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>

        {/* Interest tags */}
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {interests.slice(0, 5).map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded-full">
                {tag}
              </span>
            ))}
            {interests.length > 5 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[10px] font-medium rounded-full">
                +{interests.length - 5}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-gray-400">Complete your profile for better recommendations</p>
        )}
      </Link>
    </div>
  )
}
