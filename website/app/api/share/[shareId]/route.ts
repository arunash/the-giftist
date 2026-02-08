import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    const { shareId } = params

    // Find user by shareId
    const user = await prisma.user.findUnique({
      where: { shareId },
      include: {
        items: {
          orderBy: { addedAt: 'desc' },
          include: {
            priceHistory: {
              orderBy: { recordedAt: 'asc' },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      )
    }

    // Format items for response
    const items = user.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      priceValue: item.priceValue,
      priceHistory: item.priceHistory.map((ph) => ({
        price: ph.price,
        date: ph.recordedAt.toISOString().split('T')[0],
      })),
      image: item.image,
      url: item.url,
      domain: item.domain,
      category: item.category,
      fundedAmount: item.fundedAmount,
      goalAmount: item.goalAmount || item.priceValue,
      isPurchased: item.isPurchased,
    }))

    const categories = [...new Set(items.map((i) => i.category).filter(Boolean))]

    return NextResponse.json({
      items,
      categories,
      shareId,
      ownerName: user.name || 'Someone',
    })
  } catch (error) {
    console.error('Error fetching shared giftlist:', error)
    return NextResponse.json(
      { error: 'Failed to load wishlist' },
      { status: 500 }
    )
  }
}
