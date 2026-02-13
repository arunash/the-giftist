import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../test/mocks/prisma'
import { createActivity } from './activity'

beforeEach(() => {
  prismaMock.activityEvent.create.mockResolvedValue({
    id: 'act-1',
    userId: 'user-1',
    type: 'ITEM_ADDED',
    visibility: 'PUBLIC',
    metadata: null,
    itemId: null,
    createdAt: new Date(),
  } as any)
})

describe('createActivity', () => {
  it('creates activity with correct data', async () => {
    await createActivity({
      userId: 'user-1',
      type: 'ITEM_ADDED',
      visibility: 'PUBLIC',
      itemId: 'item-1',
      metadata: { itemName: 'Test Item' },
    })

    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'ITEM_ADDED',
        visibility: 'PUBLIC',
        metadata: JSON.stringify({ itemName: 'Test Item' }),
        itemId: 'item-1',
      },
    })
  })

  it('defaults visibility to PRIVATE', async () => {
    await createActivity({
      userId: 'user-1',
      type: 'WALLET_DEPOSIT',
    })

    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'WALLET_DEPOSIT',
        visibility: 'PRIVATE',
        metadata: null,
        itemId: undefined,
      },
    })
  })

  it('handles null metadata', async () => {
    await createActivity({
      userId: 'user-1',
      type: 'EVENT_CREATED',
    })

    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: null }),
      })
    )
  })
})
