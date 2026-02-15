import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — Public endpoint returning contribution receipt data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    include: {
      item: {
        select: { name: true, image: true, price: true, priceValue: true },
      },
      event: {
        select: { name: true, type: true },
      },
    },
  })

  if (!contribution) {
    return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: contribution.id,
    amount: contribution.amount,
    status: contribution.status,
    message: contribution.message,
    isAnonymous: contribution.isAnonymous,
    createdAt: contribution.createdAt,
    item: contribution.item
      ? {
          name: contribution.item.name,
          image: contribution.item.image,
          price: contribution.item.price,
        }
      : null,
    event: contribution.event
      ? {
          name: contribution.event.name,
          type: contribution.event.type,
        }
      : null,
  })
}
