'use client'

import { useEffect, useState, useRef } from 'react'
import { User, Sparkles, MessageCircle, ArrowRight, Send, Check, Phone, LogOut } from 'lucide-react'
import { signIn, signOut } from 'next-auth/react'
import LinkPhoneForm from './link-phone-form'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { useChatStream } from '@/lib/hooks/use-chat-stream'
import GoldUpgradeCard from '@/components/settings/gold-upgrade-card'
import CircleSection from './circle-section'

const BUDGET_LABELS: Record<string, string> = {
  UNDER_50: 'Under $50',
  '50_100': '$50 - $100',
  '100_250': '$100 - $250',
  '250_500': '$250 - $500',
  OVER_500: '$500+',
}

interface ProfileData {
  name: string | null
  email: string | null
  phone: string | null
  birthday: string | null
  gender: string | null
  ageRange: string | null
  interests: string[]
  giftBudget: string | null
  relationship: string | null
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const { messages, streaming, sendMessage, clearMessages } = useChatStream()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const hasPreferences = profile && (
    profile.interests?.length > 0 || profile.giftBudget || profile.ageRange || profile.gender || profile.relationship
  )

  const handleStartChat = () => {
    setChatOpen(true)
    if (messages.length === 0) {
      const prompt = hasPreferences
        ? "I'd like to update my preferences. Here's what I currently have set — ask me what I'd like to change."
        : "Hi! I'm new here. Help me set up my preferences — ask me about my interests, budget, and what kind of things I like."
      sendMessage(prompt)
    }
  }

  const handleSend = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || streaming) return
    sendMessage(trimmed)
    setInputValue('')
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-surface rounded-xl" />
            <div className="h-48 bg-surface rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* Account Info */}
        <div className="bg-surface rounded-xl border border-border divide-y divide-border">
          <div className="p-6">
            <label className="block text-sm font-medium text-muted mb-1">Name</label>
            <p className="text-gray-900 font-medium">{profile?.name || 'Not set'}</p>
          </div>

          {/* Phone — Primary Identity */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-green-600" />
              <label className="text-sm font-medium text-muted">WhatsApp Phone</label>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-green-600 bg-green-400/10 px-1.5 py-0.5 rounded">Primary</span>
            </div>
            {profile?.phone ? (
              <div className="flex items-center gap-2">
                <p className="text-gray-900 font-medium">+{profile.phone}</p>
                <Check className="h-4 w-4 text-green-600" />
              </div>
            ) : (
              <div>
                <p className="text-muted mb-3 text-sm">Connect your WhatsApp number to sync items from the bot.</p>
                <LinkPhoneForm />
              </div>
            )}
          </div>

          {/* Google — Secondary */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <label className="text-sm font-medium text-muted">Google</label>
            </div>
            {profile?.email ? (
              <div className="flex items-center gap-2">
                <p className="text-gray-900 font-medium">{profile.email}</p>
                <Check className="h-4 w-4 text-green-600" />
              </div>
            ) : (
              <div>
                <p className="text-muted mb-3 text-sm">Connect Google for email notifications and a richer profile.</p>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/settings' })}
                  className="inline-flex items-center gap-2 bg-surface-hover border border-border rounded-lg py-2 px-4 font-medium text-gray-900 hover:bg-surface-raised transition text-sm"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Connect Google
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gold Subscription */}
        <GoldUpgradeCard />

        {/* Profile Card */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Profile</h2>
              <p className="text-sm text-muted">Helps your Gift Concierge give better recommendations</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-full">
              <User className="h-5 w-5 text-primary" />
            </div>
          </div>

          {hasPreferences ? (
            <div className="space-y-3">
              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted uppercase tracking-wide">Interests</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {profile.interests.map((interest) => (
                      <span key={interest} className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {profile.giftBudget && (
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Budget</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{BUDGET_LABELS[profile.giftBudget] || profile.giftBudget}</p>
                  </div>
                )}
                {profile.ageRange && (
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Age Range</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.ageRange}</p>
                  </div>
                )}
                {profile.gender && (
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Gender</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.gender.replace('_', ' ').toLowerCase()}</p>
                  </div>
                )}
                {profile.relationship && (
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Household</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.relationship.toLowerCase()}</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleStartChat}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition"
              >
                <Sparkles className="h-4 w-4" />
                Update via Chat
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <MessageCircle className="h-10 w-10 text-[#333] mx-auto mb-3" />
              <p className="text-sm text-muted mb-4">
                Let your Gift Concierge get to know you for personalized recommendations.
              </p>
              <button
                onClick={handleStartChat}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition"
              >
                <Sparkles className="h-4 w-4" />
                Set Up Preferences
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Gift Circle */}
        <CircleSection />

        {/* Sign Out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition font-medium text-sm"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>

        {/* Conversational Preferences Chat */}
        {chatOpen && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Preference Chat</h3>
              <button
                onClick={() => {
                  setChatOpen(false)
                  clearMessages()
                  // Refresh profile data
                  fetch('/api/profile')
                    .then((r) => r.json())
                    .then((data) => setProfile(data))
                    .catch(() => {})
                }}
                className="text-xs text-muted hover:text-gray-900 transition"
              >
                Done
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
              {messages.map((msg, idx) => {
                // Only the last assistant message during active streaming gets autoExecute
                const isLastAssistant = streaming && msg.role === 'ASSISTANT' &&
                  !messages.slice(idx + 1).some((m) => m.role === 'ASSISTANT')
                return (
                  <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    autoExecute={isLastAssistant}
                  />
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                  placeholder="Tell me about your preferences..."
                  className="flex-1 text-sm text-gray-900 placeholder-muted outline-none bg-transparent px-3 py-2 border border-border rounded-lg"
                  disabled={streaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || streaming}
                  className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {streaming && (
                <p className="text-xs text-muted mt-1 px-1">Thinking...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
