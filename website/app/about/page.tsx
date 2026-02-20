import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About - The Giftist',
  description: 'Giftist.ai is an AI-powered gift concierge designed to simplify gifting. A product of North Beach Technologies LLC.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-secondary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-primary hover:text-primary-hover text-sm mb-8 inline-block">&larr; Back to The Giftist</Link>

        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo-light.png" alt="The Giftist" width={48} height={48} className="rounded-xl" />
          <h1 className="text-3xl font-bold text-gray-900">About The Giftist</h1>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <p className="text-base">
            Giftist.ai is an AI-powered gift concierge designed to simplify gifting.
          </p>

          <p>
            We believe gifting should be joyful, not stressful. The Giftist helps you discover the perfect gifts,
            organize wishlists, coordinate contributions from friends and family, and keep track of every
            important occasion — all through a personal AI concierge that learns your taste and preferences.
          </p>

          <p>
            Whether you&apos;re shopping for a birthday, wedding, holiday, or just because, The Giftist makes it
            easy to find, fund, and give gifts that people actually want.
          </p>

          <div className="bg-surface rounded-xl border border-border p-6 mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Company</h2>
            <p>
              Giftist.ai is a product of <strong className="text-gray-900">North Beach Technologies LLC</strong>, a
              technology company focused on building intelligent consumer tools.
            </p>
            <p className="mt-3">
              For inquiries, contact us at{' '}
              <a href="mailto:hello@giftist.ai" className="text-primary hover:text-primary-hover transition">hello@giftist.ai</a>.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex gap-6 text-xs text-muted">
            <Link href="/terms" className="hover:text-gray-900 transition">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition">Privacy Policy</Link>
            <Link href="/" className="hover:text-gray-900 transition">Home</Link>
          </div>
          <p className="text-xs text-muted mt-3">© 2026 Giftist.ai. All rights reserved. Giftist.ai is a product of North Beach Technologies LLC.</p>
        </div>
      </div>
    </div>
  )
}
