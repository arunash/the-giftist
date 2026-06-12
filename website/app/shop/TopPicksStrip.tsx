'use client';

import Image from 'next/image';

interface TopPick {
  slug: string;
  name: string;
  price?: string;
  imageUrl?: string;
}

const TOP_PICKS: TopPick[] = [
  { slug: '1rmUI4g4', name: 'Noise-Canceling Headphones', price: '$279' },
  { slug: '1pIuIMhN', name: 'SpaFinder Gift Card', price: '$50+' },
  { slug: 'ezK5Cv9s', name: 'Vitamix Explorian Blender', price: '$349' },
  { slug: 'jCmp7G0B', name: 'AirPods Pro (2nd Gen)', price: '$249' },
  { slug: 'SkyaeFhK', name: 'The Guest List', price: '$16' },
];

export default function TopPicksStrip() {
  function handleClick(slug: string, name: string) {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'CARD_CLICK', {
        event_category: 'engagement',
        event_label: 'top-picks-strip',
        value: slug,
        gift_name: name,
      });
    }
  }

  return (
    <div style={{
      width: '100%',
      background: 'rgba(0,0,0,0.03)',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
      padding: '16px 0',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 16px',
      }}>
        <p style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#6b7280',
          margin: '0 0 12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>🔥 Most clicked this week</p>
        <div style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: 4,
        }}>
          {TOP_PICKS.map((pick) => (
            <a
              key={pick.slug}
              href={`/go-r/${pick.slug}`}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => handleClick(pick.slug, pick.name)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                minWidth: 140,
                maxWidth: 160,
                background: '#fff',
                borderRadius: 12,
                padding: '12px 10px',
                border: '1px solid rgba(0,0,0,0.08)',
                textDecoration: 'none',
                flexShrink: 0,
                transition: 'box-shadow 0.15s',
              }}
            >
              <div style={{
                width: 64,
                height: 64,
                background: '#f3f4f6',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}>🎁</div>
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#111',
                margin: 0,
                textAlign: 'center',
                lineHeight: 1.3,
              }}>{pick.name}</p>
              {pick.price && (
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{pick.price}</p>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
