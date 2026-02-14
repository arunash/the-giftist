'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { X, MessageCircle, Phone, Lock } from 'lucide-react'

const DISMISS_KEY = 'linkBannerDismissed'

interface ProfileInfo {
  email: string | null
  phone: string | null
}

export function LinkAccountsBanner() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [showPhoneForm, setShowPhoneForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'verify'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISS_KEY) === 'true'
    if (wasDismissed) return

    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setProfile({ email: data.email, phone: data.phone })
        // Only show if missing one auth method
        if (!data.email || !data.phone) {
          setDismissed(false)
        }
      })
      .catch(() => {})
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  const handleLinkGoogle = () => {
    signIn('google', { callbackUrl: '/feed' })
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send code')
      } else {
        setStep('verify')
      }
    } catch {
      setError('Failed to send code.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAndLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/account/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to link phone')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Failed to link phone.')
    } finally {
      setLoading(false)
    }
  }

  if (dismissed || !profile) return null

  // Already linked both — shouldn't show but guard anyway
  if (profile.email && profile.phone) return null

  if (success) {
    return (
      <div className="mb-6 bg-green-900/30 border border-green-700/50 rounded-xl p-4 flex items-center justify-between">
        <p className="text-sm text-green-300 font-medium">
          WhatsApp linked successfully! Your items are now synced.
        </p>
        <button onClick={handleDismiss} className="text-green-400 hover:text-white transition ml-3 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Scenario A: Google user, no phone
  if (profile.email && !profile.phone) {
    return (
      <div className="mb-6 bg-surface rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-green-600/10 rounded-lg shrink-0 mt-0.5">
              <MessageCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium mb-1">
                Connect your WhatsApp number
              </p>
              <p className="text-xs text-muted">
                Sync items you add via the WhatsApp bot with your web account.
              </p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted hover:text-white transition shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!showPhoneForm ? (
          <div className="mt-3 ml-12">
            <button
              onClick={() => setShowPhoneForm(true)}
              className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              <MessageCircle className="h-4 w-4" />
              Link WhatsApp
            </button>
          </div>
        ) : (
          <div className="mt-3 ml-12 max-w-sm">
            {step === 'phone' ? (
              <form onSubmit={handleSendCode} className="space-y-2">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-9 pr-4 py-2 border border-border bg-surface-hover rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm text-white placeholder-muted"
                    required
                  />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  {loading ? 'Sending...' : 'Send Code via WhatsApp'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndLink} className="space-y-2">
                <p className="text-xs text-muted">
                  Code sent to <span className="text-white font-medium">{phone}</span>
                </p>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full pl-9 pr-4 py-2 border border-border bg-surface-hover rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm text-white placeholder-muted"
                    required
                  />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Linking...' : 'Verify & Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setError(''); setCode('') }}
                    className="text-xs text-muted hover:text-white transition"
                  >
                    Change number
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    )
  }

  // Scenario B: Phone user, no Google
  if (profile.phone && !profile.email) {
    return (
      <div className="mb-6 bg-surface rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-blue-600/10 rounded-lg shrink-0 mt-0.5">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium mb-1">
                Connect Google for a richer profile
              </p>
              <p className="text-xs text-muted">
                Get email notifications and enrich your profile with your Google account.
              </p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted hover:text-white transition shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 ml-12">
          <button
            onClick={handleLinkGoogle}
            className="flex items-center gap-2 bg-surface-hover border border-border text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-surface-raised transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Link Google
          </button>
        </div>
      </div>
    )
  }

  return null
}
