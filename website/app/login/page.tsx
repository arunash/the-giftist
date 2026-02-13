'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gift, Phone, Lock, MessageCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'verify'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleSignIn = async () => {
    setLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('phone', {
      phone,
      code,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid or expired verification code')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Gift className="h-10 w-10 text-primary" />
          <span className="text-2xl font-bold text-primary">The Giftist</span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-secondary text-center mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Sign in to access your wishlist
          </p>

          {/* Google Sign In */}
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-2 text-center">For web & extension users</p>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-lg py-3 px-4 font-medium text-secondary hover:bg-gray-50 transition disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* WhatsApp Phone Sign In */}
          <div>
            <p className="text-xs text-gray-500 mb-2 text-center">For WhatsApp users</p>
            {step === 'phone' ? (
              <form onSubmit={handleSendCode}>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  Login with WhatsApp
                </label>
                <div className="relative mb-4">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-sm mb-4">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  <MessageCircle className="h-5 w-5" />
                  {loading ? 'Sending...' : 'Send Code via WhatsApp'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <p className="text-sm text-gray-600 mb-4">
                  We sent a code to your WhatsApp at{' '}
                  <span className="font-medium">{phone}</span>
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <div className="relative mb-4">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-sm mb-4">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setError('') }}
                  className="w-full mt-3 text-gray-600 py-2 hover:text-gray-900 transition"
                >
                  Use a different number
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
