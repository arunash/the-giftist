import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const user = await prisma.user.findUnique({
    where: { id: 'cmliwct6c00009zxu0g7rns32' },
    select: { lifetimeContributionsReceived: true },
  })
  console.log('lifetimeContributionsReceived:', user?.lifetimeContributionsReceived)

  // All COMPLETED contributions received by this user (as item/event owner)
  const itemContribs = await prisma.contribution.findMany({
    where: { status: 'COMPLETED', item: { userId: 'cmliwct6c00009zxu0g7rns32' } },
    select: { amount: true, platformFeeAmount: true, item: { select: { name: true } } },
  })
  const eventContribs = await prisma.contribution.findMany({
    where: { status: 'COMPLETED', event: { userId: 'cmliwct6c00009zxu0g7rns32' } },
    select: { amount: true, platformFeeAmount: true, event: { select: { name: true } } },
  })
  console.log('\nCompleted contributions received:')
  let total = 0
  for (const c of [...itemContribs, ...eventContribs]) {
    const net = c.amount - c.platformFeeAmount
    total += net
    console.log(`  $${c.amount} (fee $${c.platformFeeAmount}, net $${net}) - ${(c as any).item?.name || (c as any).event?.name}`)
  }
  console.log(`Total net received: $${total}`)

  // All payouts (wallet transactions of type PAYOUT)
  const wallet = await prisma.wallet.findUnique({ where: { userId: 'cmliwct6c00009zxu0g7rns32' } })
  if (wallet) {
    const payouts = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, type: 'PAYOUT' },
    })
    console.log('\nPayout transactions:')
    for (const p of payouts) {
      console.log(`  ${p.description} | $${p.amount} | ${p.status}`)
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect() })
