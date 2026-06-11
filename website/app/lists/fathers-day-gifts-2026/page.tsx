import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Best Father's Day Gifts 2026 — Curated by Giftist",
  description: "Thoughtful Father's Day gift ideas for every dad. Hand-picked across tech, food, wellness, and more. Order by June 17 for delivery by June 21.",
  openGraph: {
    title: "Best Father's Day Gifts 2026",
    description: "Curated gift picks for every kind of dad. Order by June 17 for Father's Day delivery.",
  },
};

const FD_PRODUCTS = [
  {
    slug: '1rmUI4g4',
    name: 'Noise-Canceling Headphones',
    price: '$279',
    tag: 'Tech Dad',
    emoji: '🎧',
    why: 'Top-rated pick for blocking out the world. Perfect for the dad who loves music or needs focus time.',
  },
  {
    slug: 'jCmp7G0B',
    name: 'Apple AirPods Pro (2nd Gen)',
    price: '$249',
    tag: 'Apple Fan',
    emoji: '🍎',
    why: 'Spatial Audio + Adaptive Transparency. The gift he will use every single day.',
  },
  {
    slug: 'ezK5Cv9s',
    name: 'Vitamix Explorian E310 Blender',
    price: '$349',
    tag: 'Foodie Dad',
    emoji: '🥤',
    why: 'Professional-grade blending at home. Smoothies, soups, sauces — all effortless.',
  },
  {
    slug: '1pIuIMhN',
    name: 'SpaFinder Gift Card',
    price: '$50+',
    tag: 'Self-Care',
    emoji: '💆',
    why: 'Redeemable at 20,000+ spas nationwide. Give him the gift of real relaxation.',
  },
  {
    slug: 'SkyaeFhK',
    name: 'The Guest List by Lucy Foley',
    price: '$16',
    tag: 'Book Lover',
    emoji: '📚',
    why: 'A gripping thriller perfect for the dad who always has a book on the nightstand.',
  },
];

export default function FathersDayListPage() {
  const deadline = new Date('2026-06-17');
  const today = new Date();
  const daysToDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const fdDay = new Date('2026-06-21');
  const daysToFD = Math.ceil((fdDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a0a00 0%, #0f0500 100%)',
      color: '#e5e7eb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '0 0 80px',
    }}>
      {/* Urgency Banner */}
      <div style={{
        background: daysToDeadline <= 3 ? '#dc2626' : '#b45309',
        color: '#fff',
        textAlign: 'center',
        padding: '10px 16px',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}>
        🚨 {daysToDeadline > 0
          ? `Order by June 17 for Father's Day delivery — ${daysToDeadline} days left`
          : daysToFD > 0
          ? `Father's Day is ${daysToFD} days away — check same-day options`
          : "Father's Day is here!"}
      </div>

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
          color: '#f59e0b',
          margin: '0 0 16px',
          lineHeight: 1.2,
        }}>
          Father's Day Gifts He'll Actually Use
        </h1>
        <p style={{
          fontSize: 18,
          color: '#9ca3af',
          margin: '0 0 8px',
          lineHeight: 1.6,
        }}>
          Hand-picked by Giftist's AI — every item is a crowd favorite with real purchase history.
        </p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          Click any gift to go directly to the retailer. No signup needed.
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
                background: '#f59e0b',
                color: '#1a0a00',
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
              <span style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{product.price}</span>
              <span style={{
                background: '#f59e0b',
                color: '#1a0a00',
                fontSize: 14,
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 8,
              }}>Shop Now →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Trust footer */}
      <div style={{
        maxWidth: 720,
        margin: '48px auto 0',
        padding: '0 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
          Every gift links directly to the retailer. Giftist earns a small commission when you buy — at no extra cost to you.
        </p>
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0 }}>
          🔒 Secure checkout on each retailer's site
        </p>
      </div>
    </main>
  );
}
