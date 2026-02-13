import { prisma } from './db'

export async function mergeUsers(sourceUserId: string, targetUserId: string) {
  await prisma.$transaction([
    prisma.item.updateMany({
      where: { userId: sourceUserId },
      data: { userId: targetUserId },
    }),
    prisma.giftList.updateMany({
      where: { userId: sourceUserId },
      data: { userId: targetUserId },
    }),
    prisma.giftListItem.updateMany({
      where: { addedById: sourceUserId },
      data: { addedById: targetUserId },
    }),
    prisma.event.updateMany({
      where: { userId: sourceUserId },
      data: { userId: targetUserId },
    }),
    prisma.contribution.updateMany({
      where: { contributorId: sourceUserId },
      data: { contributorId: targetUserId },
    }),
    // Delete source user — cascades Account, Session
    prisma.user.delete({
      where: { id: sourceUserId },
    }),
  ])
}
