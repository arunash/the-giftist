import Link from 'next/link';
import type { Metadata } from 'next';
import QuizFdTracking from './QuizFdTracking';

export const metadata: Metadata = {
  title: "Top Gift Ideas — Curated by Giftist AI",
  description: "Hand-picked gifts for birthdays, Father's Day, anniversaries and more. Curated by AI. Click any gift to shop instantly — no account needed.",
  openGraph: {
    title: "Top Gift Ideas — Giftist AI",
    description: "AI-curated gifts. Click to shop instantly. No signup needed.",
  },
};

const PRODUCTS = [
  {
    slug: '1rmUI4g4',
    name: 'Noise-Canceling Headphones',
    price: '$279',
    tag: 'Tech',
    emoji: '🎧',
    why: 'Top-rated for blocking out the world. A crowd favorite for music lovers and remote workers.',
  },
  {
    slug: 'jCmp7G0B',
    name: 'Apple AirPods Pro (2nd Gen)',
    price: '$249',
    tag: 'Apple Fan',
    emoji: '🎵',
    why: 'Spatial Audio + Adaptive Transparency. The gift they will use every single day.',
  },
  {
    slug: 'ezK5Cv9s',
    name: 'Vitamix Explorian E310 Blender',
    price: '$349',
    tag: 'Foodie',
    emoji: '🥤',
    why: 'Professional-grade blending at home. Smoothies, soups, sauces — all effortless.',
  },
  {
    slug: '1pIuIMhN',
    name: 'SpaFinder Gift Card',
    price: '$50+',
    tag: 'Self-Care',
    emoji: '💆',
    why: 'Redeemable at 20,000+ spas nationwide. Give the gift of real relaxation.',
  },
  {
    slug: 'SkyaeFhK',
    name: 'The Guest List by Lucy Foley',
    price: '$16',
    tag: 'Book Lover',
    emoji: '📚',
    why: 'A gripping thriller — perfect for anyone who always has a book on the nightstand.',
  },
  {
    slug: 'HrMcUcIx',
    name: "My Husband's Wife by Alice Feeney",
    price: '$15',
    tag: 'Book Lover',
    emoji: '📖',
    why: 'A twisty psychological thriller. Consistently one of our most-clicked titles.',
  },
  {
    slug: '3_1mt-R4',
    name: 'Theragun Mini (2nd Gen)',
    price: '$179',
    tag: 'Fitness',
    emoji: '💪',
    why: 'Pocket-sized percussion massager. Perfect for the active person who deserves recovery.',
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
      <QuizFdTracking />
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

      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 24px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🎁</div>
        <h1 style={{
          fontSize: 'clamp(26px, 5vw, 38px)',
          fontWeight: 800,
          color: '#a78bfa',
          margin: '0 0 12px',
          lineHeight: 1.2,
        }}>
          Gifts They&apos;ll Actually Use
        </h1>
        <p style={{
          fontSize: 17,
          color: '#9ca3af',
          margin: '0 0 6px',
          lineHeight: 1.6,
        }}>
          AI-curated picks. Click any gift to shop directly — no account needed.
        </p>
        <div style={{
          display: 'inline-block',
          background: 'rgba(167,139,250,0.15)',
          border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          color: '#a78bfa',
          marginTop: 8,
        }}>
          ✓ Direct retailer links &nbsp;·&nbsp; ✓ Free shipping on most &nbsp;·&nbsp; ✓ No signup
        </div>
      </div>

      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '0 16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 20,
      }}>
        {PRODUCTS.map((product) => (
          <Link
            key={product.slug}
            href={`/p/${product.slug}`}
            data-slug={product.slug}
            data-name={product.name}
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
              cursor: 'pointer',
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

      <div style={{
        maxWidth: 560,
        margin: '48px auto 0',
        padding: '0 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 15, color: '#d1d5db', margin: '0 0 16px', lineHeight: 1.6 }}>
          Want a personalized pick? Tell our AI who you&apos;re shopping for — get 3 curated ideas in 60 seconds, free.
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
