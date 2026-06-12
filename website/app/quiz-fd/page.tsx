import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Curated Gifts for Every Occasion — Giftist",
  description: "Hand-picked gifts for birthdays, Father's Day, anniversaries and more. Curated by AI. Click any gift to shop instantly.",
  openGraph: {
    title: "Curated Gifts — Giftist",
    description: "AI-curated gifts for every occasion. Click to shop instantly.",
  },
};

const FD_PRODUCTS = [
  {
    slug: '1rmUI4g4',
    name: 'Noise-Canceling Headphones',
    price: '$279',
    tag: 'Tech Dad',
    emoji: '🎧',
    why: 'Top-rated for blocking out the world. Perfect for the dad who loves music or needs focus time.',
    occasion: 'fathers-day',
  },
  {
    slug: 'jCmp7G0B',
    name: 'Apple AirPods Pro (2nd Gen)',
    price: '$249',
    tag: 'Apple Fan',
    emoji: '🍎',
    why: 'Spatial Audio + Adaptive Transparency. The gift he will use every single day.',
    occasion: 'fathers-day',
  },
  {
    slug: 'ezK5Cv9s',
    name: 'Vitamix Explorian E310 Blender',
    price: '$349',
    tag: 'Foodie',
    emoji: '🥤',
    why: 'Professional-grade blending at home. Smoothies, soups, sauces — all effortless.',
    occasion: 'birthday',
  },
  {
    slug: '1pIuIMhN',
    name: 'SpaFinder Gift Card',
    price: '$50+',
    tag: 'Self-Care',
    emoji: '💆',
    why: 'Redeemable at 20,000+ spas nationwide. Give the gift of real relaxation.',
    occasion: 'birthday',
  },
  {
    slug: 'SkyaeFhK',
    name: 'The Guest List by Lucy Foley',
    price: '$16',
    tag: 'Book Lover',
    emoji: '📚',
    why: 'A gripping thriller — perfect for anyone who always has a book on the nightstand.',
    occasion: 'birthday',
  },
];

export default function GiftFinderPage() {
  const fdDay = new Date('2026-06-21');
  const today = new Date();
  const daysToFD = Math.ceil((fdDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const showFDBanner = daysToFD > 0 && daysToFD <= 14;
  const deadline = new Date('2026-06-17');
  const daysToDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0f0a1a 0%, #050510 100%)',
      color: '#e5e7eb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '0 0 80px',
    }}>
      {showFDBanner && (
        <div style={{
          background: daysToDeadline <= 2 ? '#dc2626' : '#b45309',
          color: '#fff',
          textAlign: 'center',
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 700,
        }}>
          🎁 Father&apos;s Day is June 21 — {daysToDeadline > 0 ? `order by June 17 (${daysToDeadline} days left)` : 'check same-day options'}
        </div>
      )}

      {/* Hero */}
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 800,
          color: '#a78bfa',
          margin: '0 0 16px',
          lineHeight: 1.2,
        }}>
          Gifts They&apos;ll Actually Use
        </h1>
        <p style={{
          fontSize: 18,
          color: '#9ca3af',
          margin: '0 0 8px',
          lineHeight: 1.6,
        }}>
          AI-curated picks for every occasion. Click any gift to shop directly — no signup needed.
        </p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          Every link goes straight to the retailer. Free shipping on most orders.
        </p>
      </div>

      {/* Product Grid */}
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '0 16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 20,
      }}>
        {FD_PRODUCTS.map((product) => (
          <Link
            key={product.slug}
            href={`/p/${product.slug}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '24px 20px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 40 }}>{product.emoji}</span>
              <span style={{
                background: '#a78bfa',
                color: '#0f0a1a',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.05em',
              }}>{product.tag}</span>
            </div>
            <h2 style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#f9fafb',
              margin: 0,
              lineHeight: 1.3,
            }}>{product.name}</h2>
            <p style={{
              fontSize: 14,
              color: '#9ca3af',
              margin: 0,
              lineHeight: 1.5,
              flexGrow: 1,
            }}>{product.why}</p>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa' }}>{product.price}</span>
              <span style={{
                background: '#a78bfa',
                color: '#0f0a1a',
                fontSize: 14,
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 8,
              }}>Shop Now →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* WA CTA */}
      <div style={{
        maxWidth: 560,
        margin: '48px auto 0',
        padding: '0 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 16, color: '#d1d5db', margin: '0 0 16px', lineHeight: 1.6 }}>
          Want a personalized recommendation? Our AI concierge is on WhatsApp — tell us who you&apos;re shopping for and get 3 picks in 60 seconds.
        </p>
        <a
          href="https://wa.me/15014438478"
          style={{
            display: 'inline-block',
            background: '#25D366',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            padding: '14px 28px',
            borderRadius: 12,
            textDecoration: 'none',
          }}
        >
          💬 Chat on WhatsApp — it&apos;s free
        </a>
      </div>

      {/* Trust footer */}
      <div style={{
        maxWidth: 720,
        margin: '32px auto 0',
        padding: '0 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>
          Every gift links directly to the retailer. Giftist earns a small commission at no extra cost to you.
        </p>
        <p style={{ fontSize: 12, color: '#4b5563', margin: 0 }}>🔒 Secure checkout on each retailer&apos;s site</p>
      </div>
    </main>
  );
}
