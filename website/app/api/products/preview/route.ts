import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractProductFromUrl } from '@/lib/extract'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 })
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    // Skip google search fallback URLs
    if (parsed.hostname === 'www.google.com') {
      return NextResponse.json({ image: null })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const product = await extractProductFromUrl(url)
    return NextResponse.json(
      { image: product.image, name: product.name, price: product.price },
      { headers: { 'Cache-Control': 'public, max-age=86400' } },
    )
  } catch {
    return NextResponse.json({ image: null })
  }
}
