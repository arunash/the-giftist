import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-secondary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-primary hover:text-primary-hover text-sm mb-8 inline-block">&larr; Back to The Giftist</Link>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-muted text-sm mb-10">Last updated: February 14, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using The Giftist (&quot;Service&quot;), operated by Giftist Inc. (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a company incorporated in the State of California, United States, you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.</p>
            <p className="mt-2">These Terms apply to all visitors, users, and others who access the Service (&quot;Users&quot;). By using the Service, you represent that you are at least 13 years of age. If you are under 18, you represent that your legal guardian has reviewed and agreed to these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>The Giftist is a gift concierge platform that allows users to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Create and manage wishlists of products, experiences, and other items</li>
              <li>Organize gift-giving events (birthdays, weddings, holidays, etc.)</li>
              <li>Receive AI-powered gift recommendations personalized to their preferences</li>
              <li>Share wishlists with friends and family via web links and WhatsApp</li>
              <li>Allow others to contribute toward funding gift items</li>
              <li>Interact with an AI gift concierge via web chat and WhatsApp</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. User Accounts</h2>
            <p>To use certain features, you must create an account using your phone number (WhatsApp) and/or Google account. You are responsible for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
            <p className="mt-2">We reserve the right to suspend or terminate accounts that violate these Terms or are inactive for an extended period.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. User Content</h2>
            <p>You retain ownership of content you submit to the Service (wishlist items, preferences, messages). By submitting content, you grant us a non-exclusive, worldwide, royalty-free license to use, store, and process that content solely for the purpose of providing and improving the Service.</p>
            <p className="mt-2">You agree not to submit content that:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Violates any applicable law or regulation</li>
              <li>Infringes on intellectual property rights of others</li>
              <li>Contains malicious code, spam, or deceptive material</li>
              <li>Is harassing, abusive, or otherwise objectionable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. AI-Powered Features</h2>
            <p>The Service uses artificial intelligence (powered by third-party AI models) to provide gift recommendations, personalized suggestions, and conversational assistance. You acknowledge that:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>AI-generated recommendations are suggestions only and may not always be accurate or appropriate</li>
              <li>We do not guarantee the availability, pricing, or quality of any recommended products or services</li>
              <li>Your interactions with the AI concierge may be stored to improve the Service and your experience</li>
              <li>AI outputs do not constitute professional advice of any kind</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Payments and Contributions</h2>
            <p>The Service may facilitate gift funding contributions through third-party payment processors (Stripe). By making or receiving contributions:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>You agree to the payment processor&apos;s terms of service</li>
              <li>We are not responsible for payment processing errors, disputes, or chargebacks</li>
              <li>Contribution amounts are at the sole discretion of the contributor</li>
              <li>We may charge service fees on transactions, which will be disclosed before payment</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Subscriptions</h2>
            <p>The Service may offer premium subscription tiers (&quot;Gold&quot;). Subscription terms:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Subscription fees are billed on a recurring basis as disclosed at purchase</li>
              <li>You may cancel your subscription at any time; access continues until the end of the billing period</li>
              <li>We reserve the right to change subscription pricing with 30 days&apos; notice</li>
              <li>Refunds are handled in accordance with applicable law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Third-Party Links and Services</h2>
            <p>The Service may contain links to third-party websites and retailers. We are not responsible for the content, products, privacy practices, or availability of third-party sites. Product information (prices, images, descriptions) is sourced from third parties and may not be current or accurate.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. WhatsApp Integration</h2>
            <p>The Service integrates with WhatsApp via the WhatsApp Business API. By using WhatsApp features:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>You consent to receiving messages from our WhatsApp Business number</li>
              <li>You may opt out of WhatsApp communications at any time by messaging &quot;STOP&quot;</li>
              <li>Your use of WhatsApp is also governed by WhatsApp&apos;s own terms of service</li>
              <li>Message and data rates from your carrier may apply</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Intellectual Property</h2>
            <p>The Service and its original content (excluding user content), features, and functionality are owned by Giftist Inc. and are protected by copyright, trademark, and other intellectual property laws. Our trademarks may not be used without prior written consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, GIFTIST INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Indemnification</h2>
            <p>You agree to indemnify, defend, and hold harmless Giftist Inc. and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including attorneys&apos; fees) arising out of or related to your use of the Service, your violation of these Terms, or your violation of any rights of a third party.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Governing Law and Dispute Resolution</h2>
            <p>These Terms are governed by the laws of the State of California, United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, conducted in California. You waive the right to participate in class action lawsuits or class-wide arbitration.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">15. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. We will notify users of material changes via email or in-app notification at least 30 days before the changes take effect. Continued use of the Service after changes become effective constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">16. Termination</h2>
            <p>We may terminate or suspend your account and access to the Service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users or the Service. Upon termination, your right to use the Service will cease immediately. You may request deletion of your data in accordance with our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">17. Severability</h2>
            <p>If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that the remaining provisions remain in full force and effect.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">18. Contact</h2>
            <p>If you have questions about these Terms, contact us at:</p>
            <p className="mt-2">Giftist Inc.<br />California, United States<br />Email: legal@giftist.ai</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-6 text-xs text-muted">
          <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
          <Link href="/" className="hover:text-white transition">Home</Link>
        </div>
      </div>
    </div>
  )
}
