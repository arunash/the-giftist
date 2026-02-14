import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const VALID_GENDERS = ['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] as const
const VALID_AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const
const VALID_BUDGETS = ['UNDER_50', '50_100', '100_250', '250_500', 'OVER_500'] as const
const VALID_RELATIONSHIPS = ['SINGLE', 'COUPLE', 'FAMILY'] as const

const updateSchema = z.object({
  birthday: z.string().nullable().optional(),
  gender: z.enum(VALID_GENDERS).nullable().optional(),
  ageRange: z.enum(VALID_AGE_RANGES).nullable().optional(),
  interests: z.array(z.string()).nullable().optional(),
  giftBudget: z.enum(VALID_BUDGETS).nullable().optional(),
  relationship: z.enum(VALID_RELATIONSHIPS).nullable().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      shareId: true,
      birthday: true,
      gender: true,
      ageRange: true,
      interests: true,
      giftBudget: true,
      relationship: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...user,
    interests: user.interests ? JSON.parse(user.interests) : [],
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data: any = {}
  const { birthday, gender, ageRange, interests, giftBudget, relationship } = parsed.data

  if (birthday !== undefined) {
    data.birthday = birthday ? new Date(birthday) : null
  }
  if (gender !== undefined) data.gender = gender
  if (ageRange !== undefined) data.ageRange = ageRange
  if (interests !== undefined) {
    data.interests = interests ? JSON.stringify(interests) : null
  }
  if (giftBudget !== undefined) data.giftBudget = giftBudget
  if (relationship !== undefined) data.relationship = relationship

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      birthday: true,
      gender: true,
      ageRange: true,
      interests: true,
      giftBudget: true,
      relationship: true,
    },
  })

  return NextResponse.json({
    ...user,
    interests: user.interests ? JSON.parse(user.interests) : [],
  })
}
