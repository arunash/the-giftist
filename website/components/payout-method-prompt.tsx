'use client'

import { useState, useEffect } from 'react'
import { Building2, Loader2, CheckCircle2, X, Plus } from 'lucide-react'
import BankOnboardingForm from '@/components/wallet/bank-onboarding-form'

interface PayoutMethodPromptProps {
  userName?: string
  userEmail?: string
  onComplete: () => void
  onDismiss?: () => void
}

type SelectedMethod = null | 'STRIPE' | 'VENMO' | 'PAYPAL'

interface ExistingMethods {
  venmoHandle: string | null
  paypalEmail: string | null
  stripeConnectAccountId: string | null
  preferredPayoutMethod: string | null
  payoutSetupComplete: boolean
}

export default function PayoutMethodPrompt({ userName, userEmail, onComplete, onDismiss }: PayoutMethodPromptProps) {
  const [selectedMethod, setSelectedMethod] = useState<SelectedMethod>(null)
  const [venmoHandle, setVenmoHandle] = useState('')
  const [paypalEmail, setPaypalEmail] = useState(userEmail || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showNudge, setShowNudge] = useState(false)
  const [justSavedMethod, setJustSavedMethod] = useState<string | null>(null)
  const [existing, setExisting] = useState<ExistingMethods | null>(null)

  useEffect(() => {
    fetch('/api/user/payout-method')
      .then(r => r.json())
      .then(data => setExisting(data))
      .catch(() => {})
  }, [])

  const hasVenmo = !!(existing?.venmoHandle)
  const hasPaypal = !!(existing?.paypalEmail)
  const hasBank = !!(existing?.stripeConnectAccountId)

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
        // Update local state
        setExisting(prev => ({
          ...prev!,
          venmoHandle: selectedMethod === 'VENMO' ? venmoHandle : prev?.venmoHandle || null,
          paypalEmail: selectedMethod === 'PAYPAL' ? paypalEmail : prev?.paypalEmail || null,
          preferredPayoutMethod: prev?.preferredPayoutMethod || selectedMethod,
          payoutSetupComplete: true,
        }))
        setJustSavedMethod(selectedMethod)
        setSelectedMethod(null)

        // Check if there are unconfigured methods — if so, show nudge
        const updatedHasVenmo = selectedMethod === 'VENMO' || hasVenmo
        const updatedHasPaypal = selectedMethod === 'PAYPAL' || hasPaypal
        const updatedHasBank = hasBank
        if (!updatedHasVenmo || !updatedHasPaypal || !updatedHasBank) {
          setShowNudge(true)
        } else {
          onComplete()
        }
      }
    } catch {
      setError('Failed to save payout method')
    } finally {
      setSaving(false)
    }
  }

  const handleBankSuccess = () => {
    setExisting(prev => ({
      ...prev!,
      stripeConnectAccountId: 'connected',
      preferredPayoutMethod: prev?.preferredPayoutMethod || 'STRIPE',
      payoutSetupComplete: true,
    }))
    setJustSavedMethod('STRIPE')
    setSelectedMethod(null)

    const updatedHasVenmo = hasVenmo
    const updatedHasPaypal = hasPaypal
    if (!updatedHasVenmo || !updatedHasPaypal) {
      setShowNudge(true)
    } else {
      onComplete()
    }
  }

  const methodLabel = (m: string) => m === 'VENMO' ? 'Venmo' : m === 'PAYPAL' ? 'PayPal' : 'Bank'

  // Nudge screen: show after saving a method, if others are unconfigured
  if (showNudge && !selectedMethod) {
    const updatedHasVenmo = justSavedMethod === 'VENMO' || hasVenmo
    const updatedHasPaypal = justSavedMethod === 'PAYPAL' || hasPaypal
    const updatedHasBank = justSavedMethod === 'STRIPE' || hasBank
    const missing: { key: SelectedMethod; label: string; desc: string }[] = []
    if (!updatedHasVenmo) missing.push({ key: 'VENMO', label: 'Venmo', desc: 'Receive Venmo contributions directly' })
    if (!updatedHasPaypal) missing.push({ key: 'PAYPAL', label: 'PayPal', desc: 'Receive PayPal contributions directly' })
    if (!updatedHasBank) missing.push({ key: 'STRIPE', label: 'Bank Account', desc: 'Receive card contributions directly' })

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
          <button onClick={() => { setShowNudge(false); onComplete() }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>

          <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {methodLabel(justSavedMethod || '')} saved!
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Add more payout methods so contributors using {missing.map(m => m.label).join(' or ')} can send funds directly to you — no waiting.
          </p>

          <div className="space-y-3 mb-4">
            {missing.map((m) => (
              <button
                key={m.key}
                onClick={() => { setSelectedMethod(m.key); setError('') }}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => { setShowNudge(false); onComplete() }}
            className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            Skip for now
          </button>
        </div>
      </div>
    )
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
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Venmo</p>
                  <p className="text-xs text-gray-500">Receive funds in your Venmo account</p>
                </div>
                {hasVenmo && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
              </button>

              <button
                onClick={() => setSelectedMethod('PAYPAL')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">PayPal</p>
                  <p className="text-xs text-gray-500">Receive funds in your PayPal account</p>
                </div>
                {hasPaypal && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
              </button>

              <button
                onClick={() => setSelectedMethod('STRIPE')}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Bank Account</p>
                  <p className="text-xs text-gray-500">Withdraw directly to your bank (free standard, 1% instant)</p>
                </div>
                {hasBank && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
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
            <BankOnboardingForm userName={userName} onSuccess={handleBankSuccess} />
          </>
        )}
      </div>
    </div>
  )
}
