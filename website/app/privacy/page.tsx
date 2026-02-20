import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-secondary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-primary hover:text-primary-hover text-sm mb-8 inline-block">&larr; Back to The Giftist</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-muted text-sm mb-4">Last updated: February 14, 2026</p>

        <p className="text-sm leading-relaxed mb-10">
          This Privacy Policy describes how Giftist.ai collects, uses, and protects your information.
          Giftist.ai is owned and operated by North Beach Technologies LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          If you have any questions about this Privacy Policy, you may contact us at privacy@giftist.ai.
        </p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>North Beach Technologies LLC, a limited liability company organized in the State of California, United States, operates The Giftist platform at giftist.ai (&quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>
            <p className="mt-2">We are committed to protecting your privacy and complying with applicable data protection laws, including the California Consumer Privacy Act (CCPA), the California Privacy Rights Act (CPRA), and the European Union General Data Protection Regulation (GDPR) where applicable.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Information We Collect</h2>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-gray-900">Account information:</strong> Name, email address, phone number (when you sign up via Google or WhatsApp)</li>
              <li><strong className="text-gray-900">Profile preferences:</strong> Birthday, gender, age range, interests, gift budget, relationship/household status</li>
              <li><strong className="text-gray-900">Wishlist data:</strong> Product URLs, item names, prices, images, and categories you add to your lists</li>
              <li><strong className="text-gray-900">Event data:</strong> Event names, types, dates, descriptions, and associated items</li>
              <li><strong className="text-gray-900">Messages:</strong> Chat conversations with our AI concierge (via web and WhatsApp)</li>
              <li><strong className="text-gray-900">Payment information:</strong> Processed securely by Stripe; we do not store full credit card numbers</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-gray-900">Usage data:</strong> Pages visited, features used, interactions with the AI concierge, timestamps</li>
              <li><strong className="text-gray-900">Device information:</strong> Browser type, operating system, device identifiers</li>
              <li><strong className="text-gray-900">Log data:</strong> IP address, access times, referring URLs</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-gray-900">Google:</strong> Name and email address when you sign in with Google</li>
              <li><strong className="text-gray-900">WhatsApp/Twilio:</strong> Phone number and message content when you interact via WhatsApp</li>
              <li><strong className="text-gray-900">Product URLs:</strong> Metadata scraped from URLs you submit (product names, prices, images, descriptions)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Create and manage your account</li>
              <li>Generate personalized AI-powered gift recommendations</li>
              <li>Build and maintain your taste profile for better suggestions</li>
              <li>Process gift contributions and payments</li>
              <li>Send transactional messages (account verification, event reminders)</li>
              <li>Send promotional messages (with your consent; you may opt out at any time)</li>
              <li>Detect, prevent, and address fraud and security issues</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">3.1 Legal Bases for Processing (GDPR)</h3>
            <p>For users in the European Economic Area (EEA) and UK, we process personal data based on:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-gray-900">Contract performance:</strong> To provide the Service you requested (account management, wishlists, events)</li>
              <li><strong className="text-gray-900">Legitimate interests:</strong> To improve the Service, prevent fraud, and provide relevant recommendations</li>
              <li><strong className="text-gray-900">Consent:</strong> For marketing communications and optional profile preferences</li>
              <li><strong className="text-gray-900">Legal obligation:</strong> To comply with applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. AI and Automated Processing</h2>
            <p>The Service uses artificial intelligence to analyze your preferences and provide personalized recommendations. This involves:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Processing your wishlist items, stated preferences, and chat interactions to build a taste profile</li>
              <li>Sending relevant context to third-party AI providers (Anthropic/Claude) to generate recommendations</li>
              <li>Automated categorization and tagging of items you add</li>
            </ul>
            <p className="mt-2">No automated decisions with legal or similarly significant effects are made about you. You may request human review of any AI-generated recommendation by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your data with:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-gray-900">Other users:</strong> When you share a wishlist or event publicly, the associated items and your display name are visible to anyone with the link</li>
              <li><strong className="text-gray-900">Service providers:</strong> Third parties that help us operate the Service:
                <ul className="list-disc pl-6 mt-1 space-y-0.5">
                  <li>Stripe (payment processing)</li>
                  <li>Twilio (WhatsApp messaging)</li>
                  <li>Anthropic (AI recommendations)</li>
                  <li>Google (authentication)</li>
                  <li>Cloudflare (hosting and security)</li>
                </ul>
              </li>
              <li><strong className="text-gray-900">Legal requirements:</strong> When required by law, subpoena, or court order</li>
              <li><strong className="text-gray-900">Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. International Data Transfers</h2>
            <p>Your data may be transferred to and processed in countries outside your country of residence, including the United States. For transfers from the EEA/UK to the US, we rely on:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
              <li>Data processing agreements with our service providers</li>
              <li>The EU-US Data Privacy Framework, where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Data Retention</h2>
            <p>We retain your personal data for as long as your account is active or as needed to provide the Service. Specifically:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-gray-900">Account data:</strong> Retained until you delete your account</li>
              <li><strong className="text-gray-900">Chat history:</strong> Retained for up to 24 months to provide continuity in AI interactions</li>
              <li><strong className="text-gray-900">Transaction records:</strong> Retained for 7 years as required by financial regulations</li>
              <li><strong className="text-gray-900">Usage logs:</strong> Retained for 12 months for analytics and security purposes</li>
            </ul>
            <p className="mt-2">After account deletion, we will delete or anonymize your data within 30 days, except where retention is required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Your Rights</h2>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">8.1 All Users</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Update or correct inaccurate data</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">8.2 California Residents (CCPA/CPRA)</h3>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-1 space-y-1">
              <li>Know what personal information we collect, use, and disclose</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of the sale or sharing of personal information (we do not sell your data)</li>
              <li>Non-discrimination for exercising your privacy rights</li>
              <li>Correct inaccurate personal information</li>
              <li>Limit the use of sensitive personal information</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-4 mb-2">8.3 EEA/UK Residents (GDPR)</h3>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-1 space-y-1">
              <li><strong className="text-gray-900">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-gray-900">Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong className="text-gray-900">Erasure:</strong> Request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li><strong className="text-gray-900">Restriction:</strong> Request restricted processing of your data</li>
              <li><strong className="text-gray-900">Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong className="text-gray-900">Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong className="text-gray-900">Withdraw consent:</strong> Withdraw consent at any time where processing is based on consent</li>
              <li><strong className="text-gray-900">Lodge a complaint:</strong> File a complaint with your local data protection authority</li>
            </ul>

            <p className="mt-3">To exercise any of these rights, contact us at privacy@giftist.ai. We will respond within 30 days (or 45 days for CCPA requests, with notice).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your data, including:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Encryption in transit (TLS/HTTPS) and at rest</li>
              <li>Access controls limiting who can view personal data</li>
              <li>Regular security assessments</li>
              <li>Secure authentication via OAuth 2.0 and OTP verification</li>
            </ul>
            <p className="mt-2">No method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Cookies and Tracking</h2>
            <p>The Service uses essential cookies for authentication and session management. We do not use third-party advertising cookies or cross-site tracking. You can control cookie settings through your browser preferences.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Children&apos;s Privacy</h2>
            <p>The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected data from a child under 13, we will delete it promptly. If you believe a child has provided us with personal data, please contact us at privacy@giftist.ai.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification at least 30 days before they take effect. The &quot;Last updated&quot; date at the top will reflect the most recent revision.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. GDPR Compliance Roadmap</h2>
            <p>We are actively implementing the following GDPR compliance features, planned for our next phase:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-gray-900">Cookie consent banner:</strong> Granular consent management for EEA/UK visitors</li>
              <li><strong className="text-gray-900">Data export (portability):</strong> Self-service download of all your personal data in JSON format</li>
              <li><strong className="text-gray-900">Account deletion:</strong> Self-service account and data deletion from the settings page</li>
              <li><strong className="text-gray-900">Consent management:</strong> Granular controls for marketing communications, AI processing, and data sharing</li>
              <li><strong className="text-gray-900">Data Processing Agreements:</strong> Formal DPAs with all sub-processors</li>
              <li><strong className="text-gray-900">Privacy dashboard:</strong> A single page to view and manage all your privacy preferences</li>
            </ul>
            <p className="mt-2">Until these features are live, you may exercise any of these rights by emailing privacy@giftist.ai.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">14. Contact Us</h2>
            <p>For privacy-related questions, requests, or complaints:</p>
            <p className="mt-2">
              North Beach Technologies LLC<br />
              California, United States<br />
              Email: privacy@giftist.ai
            </p>
            <p className="mt-2">For GDPR inquiries, you may also contact our data protection point of contact at the same email address.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex gap-6 text-xs text-muted">
            <Link href="/terms" className="hover:text-gray-900 transition">Terms of Service</Link>
            <Link href="/about" className="hover:text-gray-900 transition">About</Link>
            <Link href="/" className="hover:text-gray-900 transition">Home</Link>
          </div>
          <p className="text-xs text-muted mt-3">© 2026 Giftist.ai. All rights reserved. Giftist.ai is a product of North Beach Technologies LLC.</p>
        </div>
      </div>
    </div>
  )
}
