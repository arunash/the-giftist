import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'The Giftist - Your Personal Gift Curator'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 80,
            marginBottom: 16,
          }}
        >
          🎁
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: 'white',
            marginBottom: 16,
          }}
        >
          The Giftist
        </div>
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.85)',
            maxWidth: 600,
            textAlign: 'center',
          }}
        >
          Your Personal Gift Curator
        </div>
      </div>
    ),
    { ...size }
  )
}
