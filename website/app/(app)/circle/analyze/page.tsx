'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, X, Check, User, Sparkles, ArrowRight, Gift } from 'lucide-react'
import type { FriendProfile, GiftSuggestion } from '@/lib/chat-analysis'

type Step = 'upload' | 'pick_sender' | 'analyzing' | 'review' | 'saved'

interface Sender {
  name: string
  count: number
}

export default function AnalyzeChatPage() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [senders, setSenders] = useState<Sender[]>([])
  const [selectedSender, setSelectedSender] = useState<string | null>(null)
  const [profile, setProfile] = useState<FriendProfile | null>(null)
  const [friendName, setFriendName] = useState('')
  const [messagesAnalyzed, setMessagesAnalyzed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMemberId, setSavedMemberId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<GiftSuggestion[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const uploadFile = async (f: File) => {
    setFile(f)
    setError(null)

    const formData = new FormData()
    formData.append('file', f)

    try {
      const res = await fetch('/api/chat-analysis', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed')
        setStep('upload')
        return
      }

      if (data.step === 'pick_sender') {
        setSenders(data.senders)
        setStep('pick_sender')
      }
    } catch {
      setError('Upload failed. Please try again.')
      setStep('upload')
    }
  }

  const analyzeSender = async (senderName: string) => {
    if (!file) return
    setSelectedSender(senderName)
    setStep('analyzing')
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('friendName', senderName)

    try {
      const res = await fetch('/api/chat-analysis', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Analysis failed')
        setStep('pick_sender')
        return
      }

      setProfile(data.profile)
      setFriendName(data.friendName)
      setMessagesAnalyzed(data.messagesAnalyzed)
      if (data.suggestions) setSuggestions(data.suggestions)
      setStep('review')
    } catch {
      setError('Analysis failed. Please try again.')
      setStep('pick_sender')
    }
  }

  const saveProfile = async () => {
    if (!profile || !friendName) return
    setSaving(true)

    try {
      const res = await fetch('/api/chat-analysis/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, friendName }),
      })
      const data = await res.json()

      if (data.saved) {
        setSavedMemberId(data.circleMemberId)
        setStep('saved')
      } else {
        setError('Failed to save profile')
      }
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const removeTag = (field: keyof FriendProfile, value: string) => {
    if (!profile) return
    const arr = profile[field]
    if (Array.isArray(arr)) {
      setProfile({ ...profile, [field]: arr.filter(v => v !== value) })
    }
  }

  const reset = () => {
    setStep('upload')
    setFile(null)
    setSenders([])
    setSelectedSender(null)
    setProfile(null)
    setFriendName('')
    setError(null)
    setSavedMemberId(null)
    setSuggestions([])
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analyze a Friend's Preferences</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a WhatsApp chat export and I'll learn what they like for better gift ideas.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition ${
            dragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) uploadFile(f)
          }}
        >
          <Upload className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-900 font-medium mb-1">Drop a WhatsApp chat export here</p>
          <p className="text-sm text-gray-500 mb-4">or click to browse (.txt or .zip file)</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-hover transition"
          >
            Choose File
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.zip,text/plain,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadFile(f)
            }}
          />
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-left">
            <p className="text-xs font-medium text-gray-700 mb-2">How to export a WhatsApp chat:</p>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
              <li>Open the chat with your friend in WhatsApp</li>
              <li>Tap the menu (⋮) → More → Export Chat</li>
              <li>Choose "Without Media" (recommended)</li>
              <li>Share or save the exported file, then upload it here</li>
            </ol>
          </div>
        </div>
      )}

      {/* Step 2: Pick sender */}
      {step === 'pick_sender' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            I found {senders.reduce((a, b) => a + b.count, 0)} messages from {senders.length} people. Who do you want me to analyze?
          </p>
          {senders.map((s) => (
            <button
              key={s.name}
              onClick={() => analyzeSender(s.name)}
              className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500">{s.count} messages</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>
          ))}
          <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 mt-2">
            Upload a different file
          </button>
        </div>
      )}

      {/* Step 3: Analyzing */}
      {step === 'analyzing' && (
        <div className="text-center py-16">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Analyzing {selectedSender}'s messages...</p>
          <p className="text-sm text-gray-500 mt-1">This may take 10-20 seconds</p>
        </div>
      )}

      {/* Step 4: Review profile */}
      {step === 'review' && profile && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Analyzed {messagesAnalyzed} messages from {friendName}
              </p>
              <p className="text-xs text-gray-500">Review and edit before saving</p>
            </div>
          </div>

          {/* Personality */}
          {profile.personality && (
            <Section title="Personality">
              <p className="text-sm text-gray-700">{profile.personality}</p>
            </Section>
          )}

          {/* Interests */}
          <TagSection title="Interests" tags={profile.interests} field="interests" onRemove={removeTag} />
          <TagSection title="Brands they love" tags={profile.brands} field="brands" onRemove={removeTag} />
          <TagSection title="Gift categories" tags={profile.categories} field="categories" onRemove={removeTag} />
          <TagSection title="Dislikes" tags={profile.dislikes} field="dislikes" onRemove={removeTag} />
          <TagSection title="Favorite stores" tags={profile.favoriteStores} field="favoriteStores" onRemove={removeTag} />

          {/* Style */}
          {profile.style && (
            <Section title="Style">
              <p className="text-sm text-gray-700">{profile.style}</p>
            </Section>
          )}

          {/* Price preference */}
          {profile.pricePreference && (
            <Section title="Budget vibe">
              <p className="text-sm text-gray-700">{profile.pricePreference}</p>
            </Section>
          )}

          {/* Wish statements */}
          {profile.wishStatements.length > 0 && (
            <Section title="Things they've said they want">
              <ul className="space-y-1">
                {profile.wishStatements.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-primary mt-0.5">→</span>
                    <span>"{w}"</span>
                    <button onClick={() => removeTag('wishStatements', w)} className="text-gray-300 hover:text-red-400 ml-auto flex-shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Sizes */}
          {Object.keys(profile.sizes).length > 0 && (
            <Section title="Sizes">
              <div className="flex flex-wrap gap-2">
                {Object.entries(profile.sizes).map(([key, val]) => (
                  <span key={key} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-700">
                    {key}: {val}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Gift suggestions */}
          {suggestions.length > 0 && (
            <Section title={`Gift ideas for ${friendName}`}>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-pink-50 border border-pink-100 rounded-xl">
                    <Gift className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{s.name} <span className="text-pink-500">{s.price}</span></p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Save the profile first, then ask the Gift Concierge for personalized recommendations.</p>
            </Section>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-primary-hover transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save to Gift Circle
            </button>
            <button
              onClick={reset}
              className="px-5 py-3 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Saved */}
      {step === 'saved' && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-900 mb-2">
            {friendName}'s profile saved!
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Now when you ask for gift ideas for {friendName}, I'll use their preferences to find the perfect gift.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/chat"
              className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-hover transition"
            >
              Find gifts for {friendName}
            </a>
            <button
              onClick={reset}
              className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition"
            >
              Analyze another friend
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function TagSection({
  title,
  tags,
  field,
  onRemove,
}: {
  title: string
  tags: string[]
  field: keyof FriendProfile
  onRemove: (field: keyof FriendProfile, value: string) => void
}) {
  if (!tags.length) return null
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-700"
          >
            {tag}
            <button onClick={() => onRemove(field, tag)} className="text-gray-300 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </Section>
  )
}
