'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Lock, MessageCircle } from 'lucide-react'

export default function LinkPhoneForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'verify'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
        setLoading(false)
        return
      }

      setStep('verify')
    } catch {
      setError('Failed to send code. Please try again.')
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
        setLoading(false)
        return
      }

      setSuccess(true)
      router.refresh()
    } catch {
      setError('Failed to link phone. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <p className="text-green-600 font-medium">Phone linked successfully!</p>
    )
  }

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendCode} className="space-y-3">
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full pl-9 pr-4 py-2 border border-border bg-surface-hover rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition text-sm text-gray-900 placeholder-muted"
            required
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !phone}
          className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-green-700 transition disabled:opacity-50"
        >
          <MessageCircle className="h-4 w-4" />
          {loading ? 'Sending...' : 'Send Code via WhatsApp'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleVerifyAndLink} className="space-y-3">
      <p className="text-sm text-muted">
        Code sent to <span className="font-medium text-gray-900">{phone}</span>
      </p>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          maxLength={6}
          className="w-full pl-9 pr-4 py-2 border border-border bg-surface-hover rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition text-sm text-gray-900 placeholder-muted"
          required
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-green-700 transition disabled:opacity-50"
        >
          {loading ? 'Linking...' : 'Verify & Link'}
        </button>
        <button
          type="button"
          onClick={() => { setStep('phone'); setError('') }}
          className="text-muted text-sm hover:text-gray-900 transition"
        >
          Change number
        </button>
      </div>
    </form>
  )
}
