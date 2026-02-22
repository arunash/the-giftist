import { describe, it, expect } from 'vitest'
import { getClient, getBaseUrl } from './helpers/api-client'

describe('Share API (public)', () => {
  it('seeds an item for the share page', async () => {
    const res = await getClient().post('/api/items', {
      name: 'Share Test Item',
      url: 'https://example.com/share-item',
      image: 'https://example.com/share-image.jpg',
      price: '$19.99',
      priceValue: 19.99,
      source: 'MANUAL',
    })
    expect(res.status).toBe(201)
  })

  it('GET /api/share/:shareId returns public wishlist (no auth)', async () => {
    // Use the known shareId set during seed
    const res = await fetch(`${getBaseUrl()}/api/share/integration-test-share`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('shareId')
    expect(data).toHaveProperty('ownerName')
    expect(data.shareId).toBe('integration-test-share')
  })

  it('GET /api/share/nonexistent returns 404', async () => {
    const res = await fetch(`${getBaseUrl()}/api/share/nonexistent-share-id-xyz`)
    expect(res.status).toBe(404)
  })
})
