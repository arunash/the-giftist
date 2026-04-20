import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'

// GET: Fetch tastemaker gifts with filtering
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'pending'
  const search = searchParams.get('search') || ''

  const where: any = {}

  if (filter !== 'all') {
    where.reviewStatus = filter
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { why: { contains: search, mode: 'insensitive' } },
      { domain: { contains: search, mode: 'insensitive' } },
      { recipientTypes: { has: search.toLowerCase() } },
      { occasions: { has: search.toLowerCase() } },
      { interests: { has: search.toLowerCase() } },
    ]
  }

  const gifts = await prisma.tastemakerGift.findMany({
    where,
    orderBy: [{ totalScore: 'desc' }],
    take: 200,
  })

  const [total, pending, approved, rejected] = await Promise.all([
    prisma.tastemakerGift.count(),
    prisma.tastemakerGift.count({ where: { reviewStatus: 'pending' } }),
    prisma.tastemakerGift.count({ where: { reviewStatus: 'approved' } }),
    prisma.tastemakerGift.count({ where: { reviewStatus: 'rejected' } }),
  ])

  const avgScore = gifts.length > 0
    ? gifts.reduce((s, g) => s + g.totalScore, 0) / gifts.length
    : 0

  return NextResponse.json({
    gifts,
    totals: { total, pending, approved, rejected, avgScore },
  })
}

// POST: Review a gift (approve/reject with comment)
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await req.json()
  const { action, id, status, comment } = body

  if (action === 'review' && id && status) {
    await prisma.tastemakerGift.update({
      where: { id },
      data: {
        reviewStatus: status,
        reviewComment: comment || null,
        reviewedAt: new Date(),
      },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
