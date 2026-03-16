import { Suspense } from 'react'
import { LoginForm } from './login-form'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Sign In - The Giftist',
  description: 'Sign in to The Giftist with your phone number via WhatsApp or with Google.',
}

export default function LoginPage() {
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

          {/* Interactive form — client component */}
          <Suspense fallback={
            <div>
              <div className="relative mb-4">
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  className="w-full pl-10 pr-4 py-3 bg-surface-hover border border-border rounded-lg text-gray-900 placeholder-muted outline-none"
                  disabled
                />
              </div>
              <p className="text-xs text-muted mb-4">
                By entering your phone number, you consent to receive SMS and WhatsApp messages from Giftist
                including gift recommendations, event reminders, and account notifications.
                Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out.
                See our <a href="/sms-terms" className="underline hover:text-gray-900">SMS Terms</a>.
              </p>
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-semibold opacity-50"
              >
                Send Code via WhatsApp
              </button>
            </div>
          }>
            <LoginForm />
          </Suspense>

          {/* Google Sign In shown via noscript for crawlers */}
          <noscript>
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-center text-sm text-muted">
              Google Sign In requires JavaScript to be enabled.
            </p>
          </noscript>
        </div>

        {/* SMS consent disclosure — server-rendered, always visible to crawlers */}
        <div className="mt-4 p-4 bg-surface rounded-xl border border-border">
          <p className="text-xs text-muted leading-relaxed">
            <strong className="text-secondary">SMS &amp; WhatsApp Consent:</strong> By entering your phone number and clicking
            &quot;Send Code via WhatsApp,&quot; you consent to receive SMS and WhatsApp messages from Giftist (operated by
            North Beach Technologies LLC) including gift recommendations, event reminders, and account verification codes.
            Message frequency varies (up to 4 messages/month). Message and data rates may apply.
            You can opt out at any time by replying STOP. For help, reply HELP or
            contact <a href="mailto:support@giftist.ai" className="underline">support@giftist.ai</a>.
            See our <a href="/sms-terms" className="underline hover:text-gray-900">SMS Terms</a>.
          </p>
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
