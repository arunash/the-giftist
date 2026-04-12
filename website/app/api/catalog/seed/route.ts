import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { seedCatalog } from '@/lib/catalog-seed'

export async function POST() {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  try {
    const result = await seedCatalog()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Catalog seed error:', error)
    return NextResponse.json(
      { error: 'Failed to seed catalog', details: error.message },
      { status: 500 }
    )
  }
}
