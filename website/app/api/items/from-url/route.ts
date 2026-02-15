import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

const urlSchema = z.object({
  url: z.string().url(),
  source: z.enum(['WHATSAPP', 'EXTENSION', 'MANUAL', 'CHAT']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { url, source } = urlSchema.parse(body)

    // Check for duplicate
    const existing = await prisma.item.findFirst({
      where: { userId, url },
    })
    if (existing) {
      return NextResponse.json(existing)
    }

    const product = await extractProductFromUrl(url)

    const item = await prisma.item.create({
      data: {
        userId,
        name: product.name,
        price: product.price,
        priceValue: product.priceValue,
        image: product.image,
        url: product.url,
        domain: product.domain,
        source: source || 'MANUAL',
        goalAmount: product.priceValue,
        priceHistory: product.priceValue
          ? { create: { price: product.priceValue } }
          : undefined,
      },
      include: { priceHistory: true },
    })

    createActivity({
      userId,
      type: 'ITEM_ADDED',
      visibility: 'PUBLIC',
      itemId: item.id,
      metadata: { itemName: item.name, source: source || 'MANUAL' },
    }).catch(() => {})

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid URL', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating item from URL:', error)
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
