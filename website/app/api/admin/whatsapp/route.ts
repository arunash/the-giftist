import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const status = searchParams.get('status') || ''
  const phone = searchParams.get('phone') || ''

  const where: any = { phone: { not: '15550000000' } }
  if (status) where.status = status
  if (phone) where.phone = { contains: phone, not: '15550000000' }

  const [messages, total] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whatsAppMessage.count({ where }),
  ])

  return NextResponse.json({
    messages,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}
