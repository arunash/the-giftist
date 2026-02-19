'use client'

import { useState } from 'react'
import { Building2, Loader2, CheckCircle2, X } from 'lucide-react'
import BankOnboardingForm from '@/components/wallet/bank-onboarding-form'

interface PayoutMethodPromptProps {
  userName?: string
  userEmail?: string
  onComplete: () => void
  onDismiss?: () => void
}

type SelectedMethod = null | 'STRIPE' | 'VENMO' | 'PAYPAL'

export default function PayoutMethodPrompt({ userName, userEmail, onComplete, onDismiss }: PayoutMethodPromptProps) {
  const [selectedMethod, setSelectedMethod] = useState<SelectedMethod>(null)
  const [venmoHandle, setVenmoHandle] = useState('')
  const [paypalEmail, setPaypalEmail] = useState(userEmail || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSaveVenmoOrPaypal = async () => {
    setError('')
    if (selectedMethod === 'VENMO' && !venmoHandle.trim()) {
      setError('Please enter your Venmo handle')
      return
    }
    if (selectedMethod === 'PAYPAL' && !paypalEmail.trim()) {
      setError('Please enter your PayPal email')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/user/payout-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: selectedMethod,
          venmoHandle: selectedMethod === 'VENMO' ? venmoHandle : undefined,
          paypalEmail: selectedMethod === 'PAYPAL' ? paypalEmail : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
      } else {
        onComplete()
      }
    } catch {
      setError('Failed to save payout method')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        {onDismiss && (
          <button onClick={onDismiss} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Method selection */}
        {!selectedMethod && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2">How would you like to receive gift funds?</h2>
            <p className="text-sm text-gray-500 mb-6">Choose where friends&apos; contributions are deposited.</p>

            <div className="space-y-3">
              <button
                onClick={() => setSelectedMethod('VENMO')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">V</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Venmo</p>
                  <p className="text-xs text-gray-500">Receive funds in your Venmo account</p>
                </div>
              </button>

              <button
                onClick={() => setSelectedMethod('PAYPAL')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">PayPal</p>
                  <p className="text-xs text-gray-500">Receive funds in your PayPal account</p>
                </div>
              </button>

              <button
                onClick={() => setSelectedMethod('STRIPE')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Bank Account</p>
                  <p className="text-xs text-gray-500">Withdraw directly to your bank (free standard, 1% instant)</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Venmo input */}
        {selectedMethod === 'VENMO' && (
          <>
            <button onClick={() => { setSelectedMethod(null); setError('') }} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
              &larr; Back
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-2">What&apos;s your Venmo handle?</h2>
            <p className="text-sm text-gray-500 mb-4">We&apos;ll send your gift funds here.</p>
            <input
              value={venmoHandle}
              onChange={e => setVenmoHandle(e.target.value)}
              placeholder="@username"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30"
            />
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <button
              onClick={handleSaveVenmoOrPaypal}
              disabled={saving}
              className="mt-4 w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Venmo'}
            </button>
          </>
        )}

        {/* PayPal input */}
        {selectedMethod === 'PAYPAL' && (
          <>
            <button onClick={() => { setSelectedMethod(null); setError('') }} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
              &larr; Back
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm your PayPal email</h2>
            <p className="text-sm text-gray-500 mb-4">We&apos;ll send your gift funds to this email.</p>
            <input
              type="email"
              value={paypalEmail}
              onChange={e => setPaypalEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30"
            />
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <button
              onClick={handleSaveVenmoOrPaypal}
              disabled={saving}
              className="mt-4 w-full py-3 bg-blue-700 text-white rounded-xl font-medium hover:bg-blue-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save PayPal'}
            </button>
          </>
        )}

        {/* Stripe bank onboarding */}
        {selectedMethod === 'STRIPE' && (
          <>
            <button onClick={() => { setSelectedMethod(null); setError('') }} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
              &larr; Back
            </button>
            <BankOnboardingForm userName={userName} onSuccess={onComplete} />
          </>
        )}
      </div>
    </div>
  )
}
