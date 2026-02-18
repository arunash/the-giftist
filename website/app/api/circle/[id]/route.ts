import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logError } from '@/lib/api-logger'

const updateSchema = z.object({
  name: z.string().max(100).optional(),
  relationship: z.enum(['family', 'friend', 'work', 'other']).optional(),
})

// PATCH — update circle member
export async function PATCH(
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
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.circleMember.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = await prisma.circleMember.update({
      where: { id },
      data,
    })

    return NextResponse.json(member)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    console.error('Error updating circle member:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to update circle member' }, { status: 500 })
  }
}

// DELETE — remove circle member
export async function DELETE(
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

    const existing = await prisma.circleMember.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    await prisma.circleMember.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting circle member:', error)
    logError({ source: 'API', message: String(error), stack: (error as Error)?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Failed to delete circle member' }, { status: 500 })
  }
}
