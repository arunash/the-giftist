import { PrismaClient } from '@prisma/client'
import { TEST_USER_ID, TEST_USER_PHONE, TEST_USER_NAME } from './auth'

const prisma = new PrismaClient()

export async function seedTestUser() {
  // Clear any other user that might hold our phone number (unique constraint)
  const existing = await prisma.user.findUnique({ where: { phone: TEST_USER_PHONE } })
  if (existing && existing.id !== TEST_USER_ID) {
    await prisma.user.update({ where: { id: existing.id }, data: { phone: null } })
  }

  // Also clear any user with our shareId
  const existingShare = await prisma.user.findUnique({ where: { shareId: 'integration-test-share' } })
  if (existingShare && existingShare.id !== TEST_USER_ID) {
    await prisma.user.update({ where: { id: existingShare.id }, data: { shareId: null } })
  }

  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: { isActive: true, phone: TEST_USER_PHONE, shareId: 'integration-test-share' },
    create: {
      id: TEST_USER_ID,
      phone: TEST_USER_PHONE,
      name: TEST_USER_NAME,
      shareId: 'integration-test-share',
    },
  })
}

export async function cleanupTestData() {
  // Delete in foreign-key-safe order
  await prisma.chatMessage.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.notification.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.circleMember.deleteMany({ where: { userId: TEST_USER_ID } })

  // Items and their dependents
  const items = await prisma.item.findMany({
    where: { userId: TEST_USER_ID },
    select: { id: true },
  })
  const itemIds = items.map((i) => i.id)

  if (itemIds.length > 0) {
    await prisma.eventItem.deleteMany({ where: { itemId: { in: itemIds } } })
    await prisma.giftListItem.deleteMany({ where: { itemId: { in: itemIds } } })
    await prisma.contribution.deleteMany({ where: { itemId: { in: itemIds } } })
    await prisma.priceHistory.deleteMany({ where: { itemId: { in: itemIds } } })
    await prisma.walletTransaction.deleteMany({ where: { itemId: { in: itemIds } } })
  }

  await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } })

  // Events and their dependents
  const events = await prisma.event.findMany({
    where: { userId: TEST_USER_ID },
    select: { id: true },
  })
  const eventIds = events.map((e) => e.id)

  if (eventIds.length > 0) {
    await prisma.contribution.deleteMany({ where: { eventId: { in: eventIds } } })
    await prisma.giftList.deleteMany({ where: { eventId: { in: eventIds } } })
  }

  await prisma.event.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.giftList.deleteMany({ where: { userId: TEST_USER_ID } })

  // Wallet
  const wallet = await prisma.wallet.findUnique({ where: { userId: TEST_USER_ID } })
  if (wallet) {
    await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } })
    await prisma.wallet.delete({ where: { userId: TEST_USER_ID } })
  }

  // Subscription
  await prisma.subscription.deleteMany({ where: { userId: TEST_USER_ID } })
}

export async function teardownTestUser() {
  await cleanupTestData()
  await prisma.session.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.account.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })
}

export async function disconnectPrisma() {
  await prisma.$disconnect()
}
