import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'The Giftist - Your Personal Gift Concierge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  // Fetch logo from public URL at build/request time (works on Vercel)
  const logoUrl = new URL('/logo-dark.png', process.env.NEXTAUTH_URL || 'https://giftist.ai').toString()

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1a3a2a 0%, #0f2318 50%, #1a3a2a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          width={180}
          height={180}
          style={{ borderRadius: 32, marginBottom: 24 }}
        />
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
            color: 'rgba(255,255,255,0.75)',
            maxWidth: 600,
            textAlign: 'center',
          }}
        >
          Your Personal Gift Concierge
        </div>
      </div>
    ),
    { ...size }
  )
}
