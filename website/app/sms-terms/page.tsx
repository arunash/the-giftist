import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SMS Terms & Conditions',
}

export default function SmsTermsPage() {
  return (
    <div className="min-h-screen bg-background text-secondary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-primary hover:text-primary-hover text-sm mb-8 inline-block">&larr; Back to The Giftist</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">SMS Terms &amp; Conditions</h1>
        <p className="text-muted text-sm mb-4">Last updated: March 10, 2026</p>

        <p className="text-sm leading-relaxed mb-10">
          These SMS Terms &amp; Conditions (&quot;SMS Terms&quot;) govern text messages sent by
          Giftist, operated by North Beach Technologies LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          By opting in to receive SMS messages from Giftist, you agree to these SMS Terms.
        </p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Program Description</h2>
            <p>
              Giftist is an AI-powered gift concierge platform. When you opt in to SMS communications,
              you may receive the following types of text messages:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-gray-900">Gift recommendations:</strong> Personalized gift suggestions from your AI Gift Concierge</li>
              <li><strong className="text-gray-900">Event reminders:</strong> Notifications about upcoming birthdays, holidays, and celebrations on your calendar</li>
              <li><strong className="text-gray-900">Re-engagement nudges:</strong> Periodic check-ins with new gift ideas or features</li>
              <li><strong className="text-gray-900">Account notifications:</strong> Important updates about your Giftist account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How You Opt In</h2>
            <p>You consent to receive SMS messages from Giftist when you:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong className="text-gray-900">Create an account on giftist.ai:</strong> By providing your phone number during
                registration on <a href="https://giftist.ai" className="text-primary hover:underline">https://giftist.ai</a>,
                you consent to receive SMS messages from Giftist.
              </li>
              <li>
                <strong className="text-gray-900">Initiate a WhatsApp conversation:</strong> By messaging our WhatsApp Business number
                at +1 (501) 443-8478, you consent to receive SMS messages related to your Giftist account.
              </li>
              <li>
                <strong className="text-gray-900">Reply with a keyword:</strong> By texting START or YES to +1 (501) 443-8478,
                you consent to receive SMS messages from Giftist.
              </li>
            </ul>
            <p className="mt-2">
              Your consent to receive SMS messages is not a condition of purchasing any goods or services from Giftist.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Message Frequency</h2>
            <p>
              Message frequency varies. You may receive up to 4 messages per month.
              The actual number of messages depends on your account activity, upcoming events, and preferences.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Message and Data Rates</h2>
            <p>
              Message and data rates may apply. Giftist does not charge for SMS messages,
              but your mobile carrier&apos;s standard messaging and data rates may apply.
              Please contact your carrier for details about your messaging plan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Opt-Out Instructions</h2>
            <p>
              You may opt out of receiving SMS messages at any time by replying <strong className="text-gray-900">STOP</strong> to
              any message you receive from us. You may also text any of the following keywords
              to +1 (501) 443-8478 to opt out:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>STOP</li>
              <li>UNSUBSCRIBE</li>
              <li>CANCEL</li>
              <li>END</li>
              <li>QUIT</li>
            </ul>
            <p className="mt-2">
              After opting out, you will receive a one-time confirmation message. You will not receive
              any further SMS messages from Giftist unless you opt in again by texting START or YES.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Help</h2>
            <p>
              For help with SMS messages, reply <strong className="text-gray-900">HELP</strong> or <strong className="text-gray-900">INFO</strong> to
              any message, or contact us at:
            </p>
            <ul className="list-none pl-0 mt-2 space-y-1">
              <li>Email: <a href="mailto:support@giftist.ai" className="text-primary hover:underline">support@giftist.ai</a></li>
              <li>Phone: +1 (501) 443-8478</li>
              <li>Website: <a href="https://giftist.ai" className="text-primary hover:underline">https://giftist.ai</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Privacy</h2>
            <p>
              Your phone number and SMS opt-in data will not be shared with or sold to third parties
              for marketing purposes. Your information is used solely to send you the messages described
              in these SMS Terms. For full details on how we collect, use, and protect your information,
              please see our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Supported Carriers</h2>
            <p>
              SMS messages are supported on most major US carriers including AT&amp;T, Verizon, T-Mobile,
              Sprint, and others. Carriers are not liable for delayed or undelivered messages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to These Terms</h2>
            <p>
              We may update these SMS Terms from time to time. Material changes will be communicated
              via SMS or through our website. Continued receipt of SMS messages after changes
              constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contact Us</h2>
            <p>For questions about these SMS Terms or our messaging program, contact us at:</p>
            <p className="mt-2">
              North Beach Technologies LLC<br />
              California, United States<br />
              Email: <a href="mailto:support@giftist.ai" className="text-primary hover:underline">support@giftist.ai</a><br />
              Phone: +1 (501) 443-8478
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex gap-6 text-xs text-muted">
            <Link href="/terms" className="hover:text-gray-900 transition">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition">Privacy Policy</Link>
            <Link href="/about" className="hover:text-gray-900 transition">About</Link>
            <Link href="/" className="hover:text-gray-900 transition">Home</Link>
          </div>
          <p className="text-xs text-muted mt-3">&copy; 2026 Giftist.ai. All rights reserved. Giftist.ai is a product of North Beach Technologies LLC.</p>
        </div>
      </div>
    </div>
  )
}
