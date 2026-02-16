import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const source = searchParams.get('source') || ''

  const where = source ? { source } : {}

  const [errors, total] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.errorLog.count({ where }),
  ])

  return NextResponse.json({
    errors,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}
