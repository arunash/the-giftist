import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createTrackedLink } from '@/lib/product-link'

// Map quiz vibe/hobby answers to tastemaker interest tags
const VIBE_TO_INTERESTS: Record<string, string[]> = {
  'Outdoorsy': ['outdoor', 'fitness'],
  'Tech lover': ['tech'],
  'Foodie': ['cooking'],
  'Homebody': ['home', 'wellness'],
}
const HOBBY_TO_INTERESTS: Record<string, string[]> = {
  'Sports / fitness': ['fitness', 'outdoor'],
  'Cooking / grilling': ['cooking'],
  'Music / movies': ['music', 'tech'],
  'Reading / relaxing': ['reading', 'wellness'],
}
const BUDGET_TO_RANGE: Record<string, [number, number]> = {
  'Under $50': [0, 50],
  '$50–$100': [50, 100],
  '$100–$200': [100, 200],
  '$200+': [200, 10000],
}

export async function POST(req: NextRequest) {
  const { age, vibe, hobby, budget } = await req.json()

  const interests = Array.from(new Set([
    ...(VIBE_TO_INTERESTS[vibe as string] || []),
    ...(HOBBY_TO_INTERESTS[hobby as string] || []),
  ]))
  const [minP, maxP] = BUDGET_TO_RANGE[budget as string] || [0, 10000]

  // First pass: strict — FD-tagged AND dad AND interest match AND budget
  let rows = await prisma.tastemakerGift.findMany({
    where: {
      reviewStatus: 'approved',
      image: { not: null },
      url: { not: null },
      OR: [
        { occasions: { has: 'fathers-day' } },
        { recipientTypes: { has: 'dad' } },
      ],
      ...(interests.length > 0 ? { interests: { hasSome: interests } } : {}),
      ...(minP > 0 || maxP < 10000 ? { priceValue: { gte: minP, lte: maxP } } : {}),
    },
    orderBy: [{ totalScore: 'desc' }],
    take: 14,
  })

  // Fallback: relax interests, keep budget + dad
  if (rows.length < 5) {
    rows = await prisma.tastemakerGift.findMany({
      where: {
        reviewStatus: 'approved',
        image: { not: null },
        url: { not: null },
        OR: [
          { occasions: { has: 'fathers-day' } },
          { recipientTypes: { has: 'dad' } },
        ],
        priceValue: { gte: minP, lte: maxP },
      },
      orderBy: [{ totalScore: 'desc' }],
      take: 14,
    })
  }

  // Amazon-first re-rank (most reliable affiliate)
  const amazon = rows.filter(r => r.url?.toLowerCase().includes('amazon.com'))
  const other  = rows.filter(r => !r.url?.toLowerCase().includes('amazon.com'))
  const ranked = [...amazon, ...other].slice(0, 7)

  const picks = await Promise.all(ranked.map(async r => {
    let slug: string | undefined
    try {
      const trackedUrl = await createTrackedLink({
        productName: r.name,
        targetUrl: r.url!,
        price: r.price,
        priceValue: r.priceValue,
        image: r.image,
        source: 'QUIZ_RESULT',
      })
      slug = trackedUrl.split('/p/')[1]
    } catch {}
    return {
      id: r.id,
      name: r.name,
      price: r.price,
      image: r.image,
      domain: r.domain,
      why: r.why,
      trackedSlug: slug,
      isAmazon: r.url?.toLowerCase().includes('amazon.com') ?? false,
    }
  }))

  return NextResponse.json({ picks, debug: { interests, minP, maxP, count: picks.length } })
}
