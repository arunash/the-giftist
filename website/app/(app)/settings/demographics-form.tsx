'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

const INTEREST_OPTIONS = [
  'Tech', 'Fashion', 'Sports', 'Home', 'Kitchen', 'Beauty',
  'Books', 'Travel', 'Gaming', 'Fitness', 'Art', 'Music',
  'Outdoors', 'Kids', 'Pets',
]

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
]

const AGE_RANGE_OPTIONS = [
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35-44', label: '35-44' },
  { value: '45-54', label: '45-54' },
  { value: '55-64', label: '55-64' },
  { value: '65+', label: '65+' },
]

const BUDGET_OPTIONS = [
  { value: 'UNDER_50', label: 'Under $50' },
  { value: '50_100', label: '$50 - $100' },
  { value: '100_250', label: '$100 - $250' },
  { value: '250_500', label: '$250 - $500' },
  { value: 'OVER_500', label: '$500+' },
]

const RELATIONSHIP_OPTIONS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'COUPLE', label: 'Couple' },
  { value: 'FAMILY', label: 'Family' },
]

interface DemographicsFormProps {
  initialData: {
    birthday: string | null
    gender: string | null
    ageRange: string | null
    interests: string[]
    giftBudget: string | null
    relationship: string | null
  }
}

export default function DemographicsForm({ initialData }: DemographicsFormProps) {
  const [birthday, setBirthday] = useState(initialData.birthday || '')
  const [gender, setGender] = useState(initialData.gender || '')
  const [ageRange, setAgeRange] = useState(initialData.ageRange || '')
  const [interests, setInterests] = useState<string[]>(initialData.interests || [])
  const [giftBudget, setGiftBudget] = useState(initialData.giftBudget || '')
  const [relationship, setRelationship] = useState(initialData.relationship || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    )
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthday: birthday || null,
          gender: gender || null,
          ageRange: ageRange || null,
          interests: interests.length > 0 ? interests : null,
          giftBudget: giftBudget || null,
          relationship: relationship || null,
        }),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Birthday */}
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Birthday</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => { setBirthday(e.target.value); setSaved(false) }}
          className="w-full sm:w-auto px-3 py-2 border border-border rounded-lg text-sm text-white bg-surface-hover focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium text-muted mb-2">Gender</label>
        <div className="flex flex-wrap gap-2">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setGender(gender === opt.value ? '' : opt.value); setSaved(false) }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                gender === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-muted hover:bg-surface-raised'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Age Range */}
      <div>
        <label className="block text-sm font-medium text-muted mb-2">Age Range</label>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setAgeRange(ageRange === opt.value ? '' : opt.value); setSaved(false) }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                ageRange === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-muted hover:bg-surface-raised'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium text-muted mb-2">Interests</label>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => toggleInterest(interest)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                interests.includes(interest)
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-muted hover:bg-surface-raised'
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      {/* Gift Budget */}
      <div>
        <label className="block text-sm font-medium text-muted mb-2">Typical Gift Budget</label>
        <div className="flex flex-wrap gap-2">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setGiftBudget(giftBudget === opt.value ? '' : opt.value); setSaved(false) }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                giftBudget === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-muted hover:bg-surface-raised'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Relationship Status */}
      <div>
        <label className="block text-sm font-medium text-muted mb-2">Household</label>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setRelationship(relationship === opt.value ? '' : opt.value); setSaved(false) }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                relationship === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-muted hover:bg-surface-raised'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-primary-hover transition disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
      </button>
    </div>
  )
}
