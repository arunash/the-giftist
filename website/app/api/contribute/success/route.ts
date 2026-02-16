import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — Receipt endpoint for contributors (limited data, no sensitive info)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id || typeof id !== 'string' || id.length > 50) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    select: {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
      item: {
        select: { name: true, image: true },
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
    createdAt: contribution.createdAt,
    item: contribution.item
      ? { name: contribution.item.name, image: contribution.item.image }
      : null,
    event: contribution.event
      ? { name: contribution.event.name, type: contribution.event.type }
      : null,
  })
}
