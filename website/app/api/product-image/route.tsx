import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

/**
 * Generates a branded product card image when no real product image exists.
 * Used as the ultimate fallback in the image resolution chain.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const name = searchParams.get('name') || 'Gift'
  const emoji = searchParams.get('emoji') || '🎁'
  const category = searchParams.get('category') || ''
  const brand = searchParams.get('brand') || ''

  // Truncate long names
  const displayName = name.length > 60 ? name.slice(0, 57) + '...' : name
  const subtitle = [brand, category].filter(Boolean).join(' · ')

  // Pick a gradient based on category hash
  const gradients = [
    ['#FF6B6B', '#EE5A24'], // warm red
    ['#a18cd1', '#fbc2eb'], // lavender
    ['#667eea', '#764ba2'], // indigo
    ['#f093fb', '#f5576c'], // pink
    ['#4facfe', '#00f2fe'], // sky blue
    ['#43e97b', '#38f9d7'], // mint
    ['#fa709a', '#fee140'], // sunset
    ['#a8edea', '#fed6e3'], // pastel
  ]
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const [from, to] = gradients[hash % gradients.length]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${from}, ${to})`,
          padding: '40px',
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: 20, left: 30, width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 50, right: 60, width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 40, left: 80, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 30, right: 40, width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex' }} />

        {/* Emoji */}
        <div style={{ fontSize: 80, marginBottom: 20, display: 'flex' }}>
          {emoji}
        </div>

        {/* Product name */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: '80%',
            textShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
          }}
        >
          {displayName}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.8)',
              marginTop: 12,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'flex',
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Giftist branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 20,
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            display: 'flex',
          }}
        >
          giftist.ai
        </div>
      </div>
    ),
    {
      width: 600,
      height: 600,
    }
  )
}
