import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../test/mocks/prisma'
import { mergeUsers } from './merge-users'

beforeEach(() => {
  prismaMock.$transaction.mockResolvedValue(undefined)
})

describe('mergeUsers', () => {
  it('calls $transaction with all migration operations', async () => {
    await mergeUsers('source-user', 'target-user')

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    const ops = (prismaMock.$transaction as any).mock.calls[0][0]
    expect(ops).toHaveLength(6)
  })

  it('updates items to target user', async () => {
    await mergeUsers('source-user', 'target-user')

    expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
      where: { userId: 'source-user' },
      data: { userId: 'target-user' },
    })
  })

  it('updates gift lists to target user', async () => {
    await mergeUsers('source-user', 'target-user')

    expect(prismaMock.giftList.updateMany).toHaveBeenCalledWith({
      where: { userId: 'source-user' },
      data: { userId: 'target-user' },
    })
  })

  it('updates gift list items to target user', async () => {
    await mergeUsers('source-user', 'target-user')

    expect(prismaMock.giftListItem.updateMany).toHaveBeenCalledWith({
      where: { addedById: 'source-user' },
      data: { addedById: 'target-user' },
    })
  })

  it('updates events to target user', async () => {
    await mergeUsers('source-user', 'target-user')

    expect(prismaMock.event.updateMany).toHaveBeenCalledWith({
      where: { userId: 'source-user' },
      data: { userId: 'target-user' },
    })
  })

  it('updates contributions to target user', async () => {
    await mergeUsers('source-user', 'target-user')

    expect(prismaMock.contribution.updateMany).toHaveBeenCalledWith({
      where: { contributorId: 'source-user' },
      data: { contributorId: 'target-user' },
    })
  })

  it('deletes source user', async () => {
    await mergeUsers('source-user', 'target-user')

    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: 'source-user' },
    })
  })
})
