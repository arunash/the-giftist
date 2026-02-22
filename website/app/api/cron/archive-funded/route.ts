import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/api-logger'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const testUserId = req.nextUrl.searchParams.get('userId')

  try {
    // Backfill: set fullyFundedAt for already-funded items that don't have it
    const backfilled = await prisma.$executeRaw`
      UPDATE "Item"
      SET "fullyFundedAt" = "updatedAt"
      WHERE "fullyFundedAt" IS NULL
        AND "goalAmount" IS NOT NULL
        AND "goalAmount" > 0
        AND "fundedAmount" >= "goalAmount"
    `

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)

    // Find items fully funded for 7+ days, not purchased, not already in "Funded Gifts"
    const where: any = {
      fullyFundedAt: { not: null, lte: sevenDaysAgo },
      isPurchased: false,
      NOT: {
        eventItems: {
          some: {
            event: { name: 'Funded Gifts' },
          },
        },
      },
    }

    if (testUserId) {
      where.userId = testUserId
    }

    const items = await prisma.item.findMany({
      where,
      select: { id: true, userId: true, name: true },
    })

    // Group by userId
    const byUser = new Map<string, string[]>()
    for (const item of items) {
      const list = byUser.get(item.userId) || []
      list.push(item.id)
      byUser.set(item.userId, list)
    }

    let linked = 0
    let errors = 0

    for (const [userId, itemIds] of byUser) {
      try {
        // Find or create "Funded Gifts" event for this user
        let event = await prisma.event.findFirst({
          where: { userId, name: 'Funded Gifts' },
        })

        if (!event) {
          event = await prisma.event.create({
            data: {
              userId,
              name: 'Funded Gifts',
              type: 'OTHER',
              date: new Date('2099-12-31'),
              description: 'Items that are fully funded and ready to buy',
              isPublic: false,
            },
          })
        }

        // Create EventItem links
        for (const itemId of itemIds) {
          try {
            await prisma.eventItem.create({
              data: {
                eventId: event.id,
                itemId,
              },
            })
            linked++
          } catch (e: any) {
            // Skip unique constraint violations (already linked)
            if (e.code !== 'P2002') {
              errors++
              logError({
                source: 'CRON_ARCHIVE_FUNDED',
                message: `Failed to link item ${itemId}: ${e.message}`,
              }).catch(() => {})
            }
          }
        }
      } catch (e: any) {
        errors++
        logError({
          source: 'CRON_ARCHIVE_FUNDED',
          message: `Failed for user ${userId}: ${e.message}`,
          stack: e.stack,
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      backfilled,
      processed: items.length,
      linked,
      errors,
    })
  } catch (error: any) {
    console.error('Error in archive-funded cron:', error)
    logError({
      source: 'CRON_ARCHIVE_FUNDED',
      message: String(error),
      stack: error?.stack,
    }).catch(() => {})
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
