import type { Metadata, Viewport } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const dmSans = DM_Sans({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: {
    default: 'The Giftist - Your Personal Gift Concierge',
    template: '%s | The Giftist',
  },
  description: 'Create wishlists, organize events, and let friends contribute to your gifts. AI-powered gift recommendations tailored to you.',
  keywords: ['wishlist', 'gift registry', 'gift ideas', 'gift recommendations', 'wishlists', 'gift concierge', 'crowdfunding gifts'],
  metadataBase: new URL('https://giftist.ai'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'The Giftist',
    title: 'The Giftist - Your Personal Gift Concierge',
    description: 'Create wishlists, organize events, and let friends contribute to your gifts.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Giftist - Your Personal Gift Concierge',
    description: 'Create wishlists, organize events, and let friends contribute to your gifts.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'The Giftist',
  applicationCategory: 'ShoppingApplication',
  description: 'Create wishlists, organize events, and let friends contribute to your gifts. AI-powered gift recommendations tailored to you.',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={dmSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
