import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'
export const alt = 'The Giftist - Your Personal Gift Concierge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const logoData = await readFile(join(process.cwd(), 'public', 'logo-dark.png'))
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`

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
          src={logoSrc}
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
