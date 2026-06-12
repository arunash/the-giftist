import { redirect } from 'next/navigation'

// Affiliate-only pivot 2026-06-11. The old Giftist product page (gift-send
// CTA, save-for-later, etc.) leaked traffic away from the affiliate path.
// Any direct or SEO hit now bounces straight to the retailer redirect.
export default function ProductPage({ params }: { params: { slug: string } }) {
  redirect(`/go-r/${params.slug}`)
}
