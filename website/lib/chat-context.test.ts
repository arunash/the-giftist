import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../test/mocks/prisma'
import { buildChatContext } from './chat-context'

beforeEach(() => {
  // Default: return empty data
  prismaMock.item.findMany.mockResolvedValue([])
  prismaMock.event.findMany.mockResolvedValue([])
  prismaMock.wallet.findUnique.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue(null)
})

describe('buildChatContext', () => {
  it('returns context with empty data', async () => {
    const ctx = await buildChatContext('user-1')
    expect(ctx).toContain('Giftist Gift Concierge')
    expect(ctx).toContain('Wallet balance: $0.00')
    expect(ctx).toContain('Total items: 0')
    expect(ctx).toContain('(no items yet)')
    expect(ctx).toContain('(no upcoming events)')
  })

  it('includes item details', async () => {
    prismaMock.item.findMany.mockResolvedValue([
      {
        name: 'Nike Shoes',
        price: '$99.99',
        priceValue: 99.99,
        category: 'Shoes',
        domain: 'nike.com',
        fundedAmount: 50,
        goalAmount: 100,
        isPurchased: false,
        source: 'EXTENSION',
      } as any,
    ])

    const ctx = await buildChatContext('user-1')
    expect(ctx).toContain('Nike Shoes')
    expect(ctx).toContain('$99.99')
    expect(ctx).toContain('50% funded')
    expect(ctx).toContain('EXTENSION')
    expect(ctx).toContain('Total items: 1')
  })

  it('shows purchased status', async () => {
    prismaMock.item.findMany.mockResolvedValue([
      {
        name: 'Bought Item',
        price: '$20.00',
        priceValue: 20,
        category: null,
        domain: 'amazon.com',
        fundedAmount: 0,
        goalAmount: 20,
        isPurchased: true,
        source: 'MANUAL',
      } as any,
    ])

    const ctx = await buildChatContext('user-1')
    expect(ctx).toContain('purchased')
  })

  it('includes wallet balance', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue({ balance: 45.50 } as any)

    const ctx = await buildChatContext('user-1')
    expect(ctx).toContain('Wallet balance: $45.50')
  })

  it('includes events', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      { name: 'Birthday Party', type: 'BIRTHDAY', date: new Date('2025-06-15') } as any,
    ])

    const ctx = await buildChatContext('user-1')
    expect(ctx).toContain('Birthday Party')
    expect(ctx).toContain('BIRTHDAY')
  })

  it('includes demographics when present', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Jane',
      birthday: new Date('1990-01-15'),
      gender: 'FEMALE',
      ageRange: '25-34',
      interests: JSON.stringify(['tech', 'cooking']),
      giftBudget: '100_250',
      relationship: 'COUPLE',
    } as any)

    const ctx = await buildChatContext('user-1')
    expect(ctx).toContain('USER PROFILE & PREFERENCES')
    expect(ctx).toContain('Name: Jane')
    expect(ctx).toContain('Gender: female')
    expect(ctx).toContain('Age range: 25-34')
    expect(ctx).toContain('Interests: tech, cooking')
    expect(ctx).toContain('$100-$250')
    expect(ctx).toContain('Household: couple')
  })

  it('skips demographics section when no user data', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: null,
      birthday: null,
      gender: null,
      ageRange: null,
      interests: null,
      giftBudget: null,
      relationship: null,
    } as any)

    const ctx = await buildChatContext('user-1')
    expect(ctx).not.toContain('USER PROFILE & PREFERENCES')
  })
})
