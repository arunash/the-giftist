import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time backfill: add $0.002 surcharge to all OpenAI /responses calls
// that were logged without the web_search_preview tool cost
export async function POST() {
  const updated = await prisma.$executeRaw`
    UPDATE "ApiCallLog"
    SET "estimatedCost" = "estimatedCost" + 0.002
    WHERE provider = 'OPENAI' AND endpoint = '/responses'
  `

  return NextResponse.json({
    message: `Backfilled ${updated} OpenAI /responses records with $0.002 surcharge each`,
    recordsUpdated: updated,
    additionalCost: updated * 0.002,
  })
}
