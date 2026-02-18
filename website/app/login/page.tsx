'use client'

import { Suspense, useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, MessageCircle } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const q = searchParams.get('q')
  const postAuthUrl = q ? `/chat?q=${encodeURIComponent(q)}` : '/feed'

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(postAuthUrl)
    }
  }, [status, router, postAuthUrl])

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'verify'>('phone')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCount, setResendCount] = useState(0)
  const [resendSuccess, setResendSuccess] = useState(false)

  const handleGoogleSignIn = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setGoogleLoading(true)
    setError('')
    try {
      await signIn('google', { callbackUrl: postAuthUrl })
    } catch (err) {
      console.error('Google sign-in error:', err)
      setError('Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhoneLoading(true)
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
        setPhoneLoading(false)
        return
      }

      setStep('verify')
    } catch {
      setError('Failed to send code. Please try again.')
    } finally {
      setPhoneLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhoneLoading(true)
    setError('')

    const result = await signIn('phone', {
      phone,
      code,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid or expired verification code')
      setPhoneLoading(false)
    } else {
      router.push(postAuthUrl)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8">
          <Image src="/logo-light.png" alt="Giftist" width={44} height={44} className="rounded-xl" />
          <span className="text-2xl font-bold text-primary">The Giftist</span>
        </Link>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Sign in with WhatsApp
          </h1>
          <p className="text-muted text-center mb-8 text-sm">
            Your phone number is your identity across the app, bot, and extension
          </p>

          {/* WhatsApp Phone Sign In — Primary */}
          <div>
            {step === 'phone' ? (
              <form onSubmit={handleSendCode}>
                <div className="relative mb-4">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-10 pr-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm mb-4">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={phoneLoading || googleLoading || !phone}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  <MessageCircle className="h-5 w-5" />
                  {phoneLoading ? 'Sending...' : 'Send Code via WhatsApp'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <p className="text-sm text-muted mb-4">
                  We sent a code to your WhatsApp at{' '}
                  <span className="font-medium text-gray-900">{phone}</span>
                </p>
                {resendSuccess && (
                  <p className="text-green-400 text-sm mb-4">New code sent!</p>
                )}
                <label className="block text-sm font-medium text-secondary mb-2">
                  Verification Code
                </label>
                <div className="relative mb-4">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm mb-4">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={phoneLoading || googleLoading || code.length !== 6}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {phoneLoading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (resendCount >= 2) {
                        setError('Too many attempts. Please wait 5 minutes before trying again.')
                        return
                      }
                      setError('')
                      setResendSuccess(false)
                      setPhoneLoading(true)
                      try {
                        const res = await fetch('/api/auth/send-code', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone }),
                        })
                        const data = await res.json()
                        if (!res.ok) {
                          setError(data.error || 'Failed to resend code')
                        } else {
                          setResendCount((c) => c + 1)
                          setResendSuccess(true)
                          setTimeout(() => setResendSuccess(false), 3000)
                        }
                      } catch {
                        setError('Failed to resend code. Please try again.')
                      } finally {
                        setPhoneLoading(false)
                      }
                    }}
                    disabled={phoneLoading || resendCount >= 2}
                    className="text-sm text-primary hover:text-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendCount >= 2 ? 'Wait 5 min to retry' : 'Send code again'}
                  </button>
                  <span className="text-border">|</span>
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setError(''); setCode('') }}
                    className="text-sm text-muted hover:text-gray-900 transition"
                  >
                    Use a different number
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google Sign In — Secondary */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || phoneLoading}
            className="w-full flex items-center justify-center gap-3 bg-surface-hover border border-border rounded-lg py-2.5 px-4 text-sm text-muted hover:text-gray-900 hover:bg-surface-raised transition disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
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
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          By signing in, you agree to our{' '}
          <a href="/terms" target="_blank" className="underline hover:text-gray-900 transition">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" className="underline hover:text-gray-900 transition">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
