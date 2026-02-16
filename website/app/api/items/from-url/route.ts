import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractProductFromUrl } from '@/lib/extract'
import { createActivity } from '@/lib/activity'
import { calculateGoalAmount } from '@/lib/platform-fee'
import { logError } from '@/lib/api-logger'
import { z } from 'zod'

const urlSchema = z.object({
  url: z.string().url().refine((url) => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
    } catch { return false }
  }, 'Only HTTP(S) URLs are allowed'),
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

    // Calculate goal amount with platform fee
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeContributionsReceived: true },
    })
    const feeCalc = calculateGoalAmount(product.priceValue, user?.lifetimeContributionsReceived ?? 0)

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
        goalAmount: feeCalc.goalAmount,
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
    logError({ source: 'EXTRACT', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
