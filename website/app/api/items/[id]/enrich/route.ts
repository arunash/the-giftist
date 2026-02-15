import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { enrichItem } from '@/lib/enrich-item'
import { logError } from '@/lib/api-logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id } = params

    const item = await prisma.item.findFirst({
      where: { id, userId },
      select: { name: true, image: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (item.image) {
      return NextResponse.json({ status: 'already_enriched' })
    }

    const success = await enrichItem(id, item.name)
    return NextResponse.json({ status: success ? 'enriched' : 'no_image' })
  } catch (error) {
    console.error('Enrich endpoint error:', error)
    logError({ source: 'ENRICH', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Enrich failed' }, { status: 500 })
  }
}
