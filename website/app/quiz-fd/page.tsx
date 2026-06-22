import Link from 'next/link';

const PRODUCTS = [
  { slug: '1rmUI4g4', name: 'Noise-Canceling Headphones', price: '$279', emoji: '🎧', badge: '🔥 #1 this week' },
  { slug: 'nKB-SPAQ', name: 'Anker Power Bank 200W', price: '$89', emoji: '🔋', badge: '🔥 #2 this week' },
  { slug: '0SlUlvJE', name: 'Victorinox Multi-Tool', price: '$95', emoji: '🔧', badge: '🔥 #3 this week' },
  { slug: 'gyh4ZNpJ', name: 'Clear Shelf Dividers (Set of 6)', price: '$28', emoji: '🗂️', badge: null },
  { slug: 'NYajeiyE', name: 'Cast Iron Potato Baker', price: '$35', emoji: '🥔', badge: null },
  { slug: 'LZl79hpy', name: 'Dad Joke QR Mug', price: '$28', emoji: '☕', badge: null },
];

interface Props {
  searchParams?: { v?: string };
}

export default function QuizFdPage({ searchParams }: Props) {
  const isVariantB = searchParams?.v === 'b';

  const headline = isVariantB
    ? 'They already have everything. That\'s what makes this hard.'
    : 'Find the perfect gift for any occasion';

  const subhead = isVariantB
    ? 'These are the gifts that actually surprise people — curated from Wirecutter, Reddit, and 10,000 gift shoppers.'
    : 'Birthday, anniversary, or just because — curated gifts people actually love, not another gift card.';

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto', padding: '16px 16px 40px' }}>

      {/* Hero */}
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.25 }}>
        {headline}
      </h1>
      <p style={{ color: '#555', margin: '0 0 20px', fontSize: 15 }}>
        {subhead}
      </p>

      {/* Social Proof Bar */}
      <div style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>🔥</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Most clicked this week</div>
          <div style={{ fontSize: 12, color: '#666' }}>Top picks from thousands of gift shoppers right now</div>
        </div>
      </div>

      {/* Product Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        {PRODUCTS.map((p) => (
          <Link
            key={p.slug}
            href={`/p/${p.slug}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              border: p.badge ? '2px solid #2563eb' : '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '14px 12px',
              background: p.badge ? '#eff6ff' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minHeight: 120,
            }}>
              {p.badge && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#2563eb',
                  background: '#dbeafe',
                  borderRadius: 4,
                  padding: '2px 6px',
                  alignSelf: 'flex-start',
                  marginBottom: 2,
                }}>
                  {p.badge}
                </span>
              )}
              <div style={{ fontSize: 26 }}>{p.emoji}</div>
              <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 14 }}>{p.price}</div>
              <div style={{
                marginTop: 'auto',
                background: '#111',
                color: '#fff',
                borderRadius: 6,
                padding: '6px 0',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
              }}>
                Shop Now &rarr;
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Occasion Chips */}
      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}>
        {['🎂 Birthday', '💍 Anniversary', '🎉 Just Because', '🙏 Thank You'].map((label) => (
          <span key={label} style={{
            background: '#f3f4f6',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 13,
            color: '#374151',
            fontWeight: 500,
          }}>
            {label}
          </span>
        ))}
      </div>

      {/* Trust Footer */}
      <div style={{
        textAlign: 'center',
        color: '#888',
        fontSize: 13,
        borderTop: '1px solid #f0f0f0',
        paddingTop: 20,
      }}>
        <div style={{ marginBottom: 6 }}>✅ Curated from Wirecutter, Strategist &amp; Reddit top picks</div>
        <div style={{ marginBottom: 6 }}>🛡️ Free shipping available on most items</div>
        <div>Powered by <strong>Giftist</strong> &mdash; AI gift concierge</div>
      </div>

    </main>
  );
}
