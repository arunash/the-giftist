import { prisma } from './db'

export type ActivityType =
  | 'ITEM_ADDED'
  | 'ITEM_FUNDED'
  | 'ITEM_PURCHASED'
  | 'WALLET_DEPOSIT'
  | 'CONTRIBUTION_RECEIVED'
  | 'EVENT_CREATED'

export async function createActivity({
  userId,
  type,
  visibility = 'PRIVATE',
  metadata,
  itemId,
}: {
  userId: string
  type: ActivityType
  visibility?: 'PRIVATE' | 'PUBLIC'
  metadata?: Record<string, any>
  itemId?: string
}) {
  return prisma.activityEvent.create({
    data: {
      userId,
      type,
      visibility,
      metadata: metadata ? JSON.stringify(metadata) : null,
      itemId,
    },
  })
}
