import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Return & Refund Policy',
  description: 'Giftist return and refund policy for products purchased through our recommendations and concierge service.',
}

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-secondary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-primary hover:text-primary-hover text-sm mb-8 inline-block">&larr; Back to The Giftist</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Return &amp; Refund Policy</h1>
        <p className="text-muted text-sm mb-8">Last updated: April 26, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
            <p>
              Giftist accepts returns and exchanges for both defective and non-defective products
              within <strong>30 days of delivery</strong>. The exact process depends on how the
              product was purchased:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li><strong>If we shipped it to you</strong> (orders placed through our concierge or checkout): contact us at <a href="mailto:hello@giftist.ai" className="text-primary hover:text-primary-hover">hello@giftist.ai</a> within 30 days.</li>
              <li><strong>If you bought directly from the retailer</strong> (Amazon, Etsy, Uncommon Goods, etc. — via a link from our site): the retailer&apos;s own return policy applies. We can help you find it.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Eligibility</h2>
            <p>To be eligible for a return or exchange:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>The item must be returned within <strong>30 days</strong> of the original delivery date.</li>
              <li>The item must be unused, in its original condition, and in its original packaging.</li>
              <li>Proof of purchase (order number, confirmation email, or gift redemption code) is required.</li>
              <li>Personalized or custom-made items may not be eligible unless they arrived defective. We&apos;ll review case-by-case.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How to start a return or exchange</h2>
            <p>Email <a href="mailto:hello@giftist.ai" className="text-primary hover:text-primary-hover">hello@giftist.ai</a> with:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your order number or gift redemption code</li>
              <li>The item(s) you&apos;d like to return or exchange</li>
              <li>The reason (defective, didn&apos;t fit, changed mind, wrong item, etc.)</li>
              <li>Whether you&apos;d like a refund or an exchange</li>
            </ul>
            <p className="mt-2">We respond within 1 business day with return shipping instructions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Refund processing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Refunds are issued to the original payment method.</li>
              <li>Once we receive and inspect the returned item, we process the refund within <strong>3–5 business days</strong>.</li>
              <li>Bank or card processing may take an additional 5–10 business days to appear on your statement.</li>
              <li>For defective items, we cover return shipping. For non-defective returns (changed mind, didn&apos;t fit, etc.), the customer is responsible for return shipping costs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Exchanges</h2>
            <p>
              Exchanges are processed the same way as returns. Once we receive your returned item,
              we ship the replacement at no additional shipping charge. If the replacement
              costs more than the original, we&apos;ll send you a payment link for the difference.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Items purchased from third-party retailers</h2>
            <p>
              Many of our recommendations link you directly to retailers like Amazon, Etsy,
              Uncommon Goods, Walmart, Target, and others. When you purchase from these retailers,
              your transaction is with them — not Giftist. The retailer&apos;s own return policy applies.
            </p>
            <p className="mt-2">
              We&apos;re happy to help you find the right return policy or contact the retailer on your behalf —
              just email <a href="mailto:hello@giftist.ai" className="text-primary hover:text-primary-hover">hello@giftist.ai</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Damaged or defective items</h2>
            <p>
              If your item arrives damaged or defective, contact us within <strong>7 days</strong> of
              delivery with a photo. We&apos;ll arrange a replacement or full refund (including shipping)
              at no cost to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Contact</h2>
            <p>For any return, exchange, or refund question:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Email: <a href="mailto:hello@giftist.ai" className="text-primary hover:text-primary-hover">hello@giftist.ai</a></li>
              <li>WhatsApp: <a href="https://wa.me/15014438478" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover">+1 (501) 443-8478</a></li>
              <li>Mailing address: North Beach Technologies LLC, California, USA</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <Link href="/" className="text-primary hover:text-primary-hover text-sm">&larr; Back to The Giftist</Link>
        </div>
      </div>
    </div>
  )
}
