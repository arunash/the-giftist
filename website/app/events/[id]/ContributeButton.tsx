'use client'

import { useState, useCallback } from 'react'
import { formatPrice } from '@/lib/utils'
import { DollarSign, X, Info, Loader2, CheckCircle2 } from 'lucide-react'

interface ContributeButtonProps {
  itemId: string
  itemName: string
  remaining: number
  ownerName?: string
}

export default function ContributeButton({
  itemId,
  itemName,
  remaining,
  ownerName,
}: ContributeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [contributorEmail, setContributorEmail] = useState('')

  // Braintree inline flow state
  const [braintreeState, setBraintreeState] = useState<{
    provider: string
    paymentProvider: string
    clientToken: string
    contributionId: string
  } | null>(null)
  const [btProcessing, setBtProcessing] = useState(false)
  const [btSuccess, setBtSuccess] = useState(false)
  const [btError, setBtError] = useState('')

  const suggestedAmounts = [10, 25, 50, 100].filter((a) => a <= remaining)

  const handleBraintreePayment = useCallback(async (state: typeof braintreeState) => {
    if (!state) return
    setBtProcessing(true)
    setBtError('')

    try {
      const braintree = await import('braintree-web')
      const clientInstance = await braintree.client.create({ authorization: state.clientToken })

      if (state.paymentProvider === 'VENMO') {
        const venmoInstance = await braintree.venmo.create({
          client: clientInstance,
          allowDesktop: true,
          paymentMethodUsage: 'single_use',
        })
        const { nonce } = await venmoInstance.tokenize() as any

        const res = await fetch('/api/braintree/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nonce,
            contributionId: state.contributionId,
            amount: parseFloat(amount),
            provider: 'VENMO',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Payment failed')
        setBtSuccess(true)
      } else {
        const paypalInstance = await braintree.paypalCheckout.create({ client: clientInstance })
        const { nonce } = await paypalInstance.createPayment({
          flow: 'checkout' as any,
          amount: parseFloat(amount).toFixed(2),
          currency: 'USD',
          intent: 'authorize' as any,
        }).then(() => paypalInstance.tokenizePayment({} as any)) as any

        const res = await fetch('/api/braintree/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nonce,
            contributionId: state.contributionId,
            amount: parseFloat(amount),
            provider: 'PAYPAL',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Payment failed')
        setBtSuccess(true)
      }
    } catch (err: any) {
      setBtError(err.message || 'Payment failed. Please try again.')
    } finally {
      setBtProcessing(false)
    }
  }, [amount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)

    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (numAmount > remaining) {
      alert(`Maximum contribution is ${formatPrice(remaining)}`)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          amount: numAmount,
          message: message || null,
          isAnonymous,
          contributorEmail: contributorEmail || null,
          returnUrl: window.location.pathname,
        }),
      })

      const data = await res.json()

      if (res.ok && data.url) {
        window.location.href = data.url
      } else if (res.ok && data.provider === 'BRAINTREE') {
        setBraintreeState(data)
        setLoading(false)
        handleBraintreePayment(data)
      } else {
        alert(data.error || 'Failed to contribute')
        setLoading(false)
      }
    } catch (error) {
      console.error(error)
      alert('Failed to contribute')
      setLoading(false)
    }
  }

  const paymentProviderLabel = braintreeState?.paymentProvider === 'VENMO' ? 'Venmo'
    : braintreeState?.paymentProvider === 'PAYPAL' ? 'PayPal' : 'Stripe'

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex-1 flex items-center justify-center gap-1 bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-hover transition"
      >
        <DollarSign className="h-4 w-4" />
        Contribute
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 relative border border-border max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setIsOpen(false); setBraintreeState(null); setBtSuccess(false); setBtError('') }}
              className="absolute top-4 right-4 text-muted hover:text-gray-900 transition"
            >
              <X className="h-6 w-6" />
            </button>

            {btSuccess ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Payment sent!</h2>
                <p className="text-sm text-muted">
                  Your {formatPrice(parseFloat(amount))} contribution via {paymentProviderLabel} is being processed.
                </p>
                <button
                  onClick={() => { setIsOpen(false); setBraintreeState(null); setBtSuccess(false) }}
                  className="mt-6 px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition"
                >
                  Done
                </button>
              </div>
            ) : braintreeState ? (
              <div className="text-center py-8">
                {btProcessing ? (
                  <>
                    <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      Complete payment in {paymentProviderLabel}
                    </h2>
                    <p className="text-sm text-muted">
                      {braintreeState.paymentProvider === 'VENMO'
                        ? 'Approve the payment in the Venmo app or scan the QR code.'
                        : 'Complete the payment in the PayPal popup.'}
                    </p>
                  </>
                ) : btError ? (
                  <>
                    <p className="text-red-600 font-medium mb-4">{btError}</p>
                    <button
                      onClick={() => handleBraintreePayment(braintreeState)}
                      className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition"
                    >
                      Try Again
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Contribute to Gift</h2>
                <p className="text-muted text-sm mb-4 line-clamp-2">{itemName}</p>

                <div className="flex gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-5">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    You&apos;re contributing funds toward this gift.{' '}
                    {ownerName || 'The recipient'} will purchase it themselves.
                    You&apos;ll be notified when they do.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Select Amount</label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {suggestedAmounts.map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAmount(String(a))}
                          className={`py-2 rounded-lg font-medium transition ${
                            amount === String(a)
                              ? 'bg-primary text-white'
                              : 'bg-surface-hover text-gray-900 hover:bg-surface-raised'
                          }`}
                        >
                          ${a}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Custom amount"
                        min="1"
                        max={remaining}
                        step="0.01"
                        className="w-full pl-8 pr-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                        required
                      />
                    </div>
                    <p className="text-sm text-muted mt-1">{formatPrice(remaining)} remaining to fully fund</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Message (optional)</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Add a personal message..."
                      rows={2}
                      className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Your email (optional, for updates)</label>
                    <input
                      type="email"
                      value={contributorEmail}
                      onChange={(e) => setContributorEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-4 h-4 text-primary border-border rounded focus:ring-primary bg-surface-hover"
                    />
                    <span className="text-sm text-muted">Contribute anonymously</span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading || !amount}
                    className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : `Contribute ${amount ? formatPrice(parseFloat(amount)) : ''}`}
                  </button>

                  <p className="text-xs text-muted text-center">Secure payment processing</p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
