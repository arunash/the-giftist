import { NextRequest, NextResponse } from 'next/server'
import { recommendProducts, RecommendationRequest } from '@/lib/catalog-recommend'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RecommendationRequest

    const products = await recommendProducts({
      recipient: body.recipient,
      occasion: body.occasion,
      budget: body.budget,
      interests: body.interests,
      vibes: body.vibes,
      themes: body.themes,
      excludeIds: body.excludeIds,
      limit: body.limit,
    })

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Catalog recommend error:', error)
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    )
  }
}
