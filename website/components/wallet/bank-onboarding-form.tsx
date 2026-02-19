'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

interface BankOnboardingFormProps {
  userName?: string
  onSuccess: () => void
}

type Step = 'identity' | 'address' | 'bank'

export default function BankOnboardingForm({ userName, onSuccess }: BankOnboardingFormProps) {
  const [step, setStep] = useState<Step>('identity')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Pre-fill name from profile
  const nameParts = (userName || '').trim().split(/\s+/)

  // Identity fields
  const [firstName, setFirstName] = useState(nameParts[0] || '')
  const [lastName, setLastName] = useState(nameParts.length > 1 ? nameParts.slice(1).join(' ') : '')
  const [dobMonth, setDobMonth] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [ssnLast4, setSsnLast4] = useState('')

  // Address fields
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')

  // Bank fields
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')

  const steps: Step[] = ['identity', 'address', 'bank']
  const stepIndex = steps.indexOf(step)

  const validateIdentity = () => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'Required'
    if (!lastName.trim()) errors.lastName = 'Required'
    if (!dobMonth || !dobDay || !dobYear) errors.dob = 'Required'
    else {
      const m = parseInt(dobMonth), d = parseInt(dobDay), y = parseInt(dobYear)
      if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2010) errors.dob = 'Invalid date'
    }
    if (!/^\d{4}$/.test(ssnLast4)) errors.ssn_last_4 = 'Must be 4 digits'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateAddress = () => {
    const errors: Record<string, string> = {}
    if (!line1.trim()) errors['address.line1'] = 'Required'
    if (!city.trim()) errors['address.city'] = 'Required'
    if (!state) errors['address.state'] = 'Required'
    if (!/^\d{5}/.test(postalCode)) errors['address.postal_code'] = 'Invalid ZIP'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateBank = () => {
    const errors: Record<string, string> = {}
    if (!/^\d{9}$/.test(routingNumber)) errors['bankAccount.routing_number'] = 'Must be 9 digits'
    if (!/^\d{4,17}$/.test(accountNumber)) errors['bankAccount.account_number'] = 'Invalid account number'
    if (accountNumber !== confirmAccountNumber) errors.confirmAccountNumber = 'Account numbers don\'t match'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    setError('')
    if (step === 'identity' && validateIdentity()) setStep('address')
    if (step === 'address' && validateAddress()) setStep('bank')
  }

  const handleSubmit = async () => {
    setError('')
    if (!validateBank()) return

    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob: { month: parseInt(dobMonth), day: parseInt(dobDay), year: parseInt(dobYear) },
          ssn_last_4: ssnLast4,
          address: {
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            state,
            postal_code: postalCode.trim(),
          },
          bankAccount: {
            routing_number: routingNumber,
            account_number: accountNumber,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors)
          // Jump to the step that has the error
          const errorKeys = Object.keys(data.fieldErrors)
          if (errorKeys.some(k => ['firstName','lastName','dob','ssn_last_4'].some(f => k.startsWith(f)))) setStep('identity')
          else if (errorKeys.some(k => k.startsWith('address'))) setStep('address')
        }
        setError(data.error || 'Something went wrong')
      } else {
        onSuccess()
      }
    } catch {
      setError('Failed to connect bank account')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30 transition ${
      fieldErrors[field] ? 'border-red-300 focus:ring-red-300' : 'border-gray-200'
    }`

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-xs text-red-500 mt-1">{fieldErrors[field]}</p> : null

  return (
    <div>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full transition ${
              i < stepIndex ? 'bg-emerald-500' : i === stepIndex ? 'bg-primary' : 'bg-gray-200'
            }`} />
            {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Identity */}
      {step === 'identity' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Your name</h3>
            <p className="text-sm text-gray-500 mb-4">This must match your bank account holder name.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className={inputClass('firstName')} />
              <FieldError field="firstName" />
            </div>
            <div>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className={inputClass('lastName')} />
              <FieldError field="lastName" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date of birth</label>
            <div className="grid grid-cols-3 gap-2">
              <input value={dobMonth} onChange={e => setDobMonth(e.target.value)} placeholder="MM" maxLength={2} className={inputClass('dob')} />
              <input value={dobDay} onChange={e => setDobDay(e.target.value)} placeholder="DD" maxLength={2} className={inputClass('dob')} />
              <input value={dobYear} onChange={e => setDobYear(e.target.value)} placeholder="YYYY" maxLength={4} className={inputClass('dob')} />
            </div>
            <FieldError field="dob" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last 4 of SSN</label>
            <input value={ssnLast4} onChange={e => setSsnLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" maxLength={4} className={inputClass('ssn_last_4')} />
            <FieldError field="ssn_last_4" />
            <p className="text-xs text-gray-400 mt-1">Required for identity verification. Encrypted and secure.</p>
          </div>
        </div>
      )}

      {/* Step 2: Address */}
      {step === 'address' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Your address</h3>
            <p className="text-sm text-gray-500 mb-4">US addresses only. Must match your bank records.</p>
          </div>
          <div>
            <input value={line1} onChange={e => setLine1(e.target.value)} placeholder="Street address" className={inputClass('address.line1')} />
            <FieldError field="address.line1" />
          </div>
          <input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Apt, suite, etc. (optional)" className={inputClass('address.line2')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className={inputClass('address.city')} />
              <FieldError field="address.city" />
            </div>
            <div>
              <select value={state} onChange={e => setState(e.target.value)} className={inputClass('address.state')}>
                <option value="">State</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <FieldError field="address.state" />
            </div>
          </div>
          <div>
            <input value={postalCode} onChange={e => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="ZIP code" maxLength={5} className={inputClass('address.postal_code')} />
            <FieldError field="address.postal_code" />
          </div>
        </div>
      )}

      {/* Step 3: Bank */}
      {step === 'bank' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Bank account</h3>
            <p className="text-sm text-gray-500 mb-4">Where your gift funds will be deposited.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Routing number</label>
            <input value={routingNumber} onChange={e => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9 digits" maxLength={9} className={inputClass('bankAccount.routing_number')} />
            <FieldError field="bankAccount.routing_number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account number</label>
            <input value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 17))} placeholder="Account number" maxLength={17} className={inputClass('bankAccount.account_number')} />
            <FieldError field="bankAccount.account_number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm account number</label>
            <input value={confirmAccountNumber} onChange={e => setConfirmAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 17))} placeholder="Re-enter account number" maxLength={17} className={inputClass('confirmAccountNumber')} />
            <FieldError field="confirmAccountNumber" />
          </div>
          <p className="text-xs text-gray-400">By continuing, you agree to <a href="/terms" className="underline">Stripe&apos;s Connected Account Agreement</a>.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {stepIndex > 0 && (
          <button
            onClick={() => { setStep(steps[stepIndex - 1]); setError(''); setFieldErrors({}) }}
            className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}
        {step !== 'bank' ? (
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Connect Bank Account
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
