import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/whatsapp'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const addMemberSchema = z.object({
  phone: z.string().min(7).max(20),
  name: z.string().max(100).optional(),
  relationship: z.enum(['family', 'friend', 'work', 'other']).optional(),
})

// GET — list circle members
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const members = await prisma.circleMember.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error listing circle members:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to list circle members' }, { status: 500 })
  }
}

// POST — add circle member
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const data = addMemberSchema.parse(body)
    const phone = normalizePhone(data.phone)

    const member = await prisma.circleMember.upsert({
      where: { userId_phone: { userId, phone } },
      update: {
        name: data.name ?? undefined,
        relationship: data.relationship ?? undefined,
      },
      create: {
        userId,
        phone,
        name: data.name || null,
        relationship: data.relationship || null,
        source: 'MANUAL',
      },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Error adding circle member:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to add circle member' }, { status: 500 })
  }
}
