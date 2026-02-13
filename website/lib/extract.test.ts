import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractProductFromUrl } from './extract'

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(html: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html),
  }))
}

function mockFetchError() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
}

describe('extractProductFromUrl', () => {
  it('extracts from JSON-LD', async () => {
    mockFetch(`
      <html><head>
        <script type="application/ld+json">
          {"@type": "Product", "name": "Nike Air Max", "offers": {"price": "129.99", "priceCurrency": "USD"}, "image": "https://example.com/shoe.jpg"}
        </script>
      </head><body></body></html>
    `)

    const result = await extractProductFromUrl('https://example.com/product')
    expect(result.name).toBe('Nike Air Max')
    expect(result.price).toBe('$129.99')
    expect(result.priceValue).toBe(129.99)
    expect(result.image).toBe('https://example.com/shoe.jpg')
    expect(result.domain).toBe('example.com')
  })

  it('extracts from Open Graph tags', async () => {
    mockFetch(`
      <html><head>
        <meta property="og:title" content="Cool Gadget" />
        <meta property="og:image" content="https://example.com/gadget.jpg" />
        <meta property="product:price:amount" content="49.99" />
        <meta property="product:price:currency" content="USD" />
      </head><body></body></html>
    `)

    const result = await extractProductFromUrl('https://shop.example.com/gadget')
    expect(result.name).toBe('Cool Gadget')
    expect(result.price).toBe('$49.99')
    expect(result.priceValue).toBe(49.99)
    expect(result.image).toBe('https://example.com/gadget.jpg')
  })

  it('extracts from DOM selectors', async () => {
    mockFetch(`
      <html><head><title>Product Page</title></head><body>
        <h1>Leather Wallet</h1>
        <span class="price">$35.00</span>
        <img itemprop="image" src="https://example.com/wallet.jpg" />
      </body></html>
    `)

    const result = await extractProductFromUrl('https://example.com/wallet')
    expect(result.name).toBe('Leather Wallet')
    expect(result.price).toBe('$35.00')
    expect(result.image).toBe('https://example.com/wallet.jpg')
  })

  it('falls back to title tag', async () => {
    mockFetch(`
      <html><head><title>Amazing Product - Store Name</title></head><body></body></html>
    `)

    const result = await extractProductFromUrl('https://store.com/something')
    expect(result.name).toBe('Amazing Product')
  })

  it('returns domain as fallback name on fetch error', async () => {
    mockFetchError()
    const result = await extractProductFromUrl('https://unreachable.com/product')
    expect(result.name).toBe('unreachable.com')
    expect(result.price).toBeNull()
    expect(result.image).toBeNull()
    expect(result.url).toBe('https://unreachable.com/product')
  })

  it('handles JSON-LD with @graph wrapper', async () => {
    mockFetch(`
      <html><head>
        <script type="application/ld+json">
          {"@graph": [{"@type": "Product", "name": "Graph Product", "offers": {"price": "19.99"}}]}
        </script>
      </head><body></body></html>
    `)

    const result = await extractProductFromUrl('https://example.com/graph')
    expect(result.name).toBe('Graph Product')
    expect(result.priceValue).toBe(19.99)
  })

  it('handles JSON-LD array', async () => {
    mockFetch(`
      <html><head>
        <script type="application/ld+json">
          [{"@type": "WebSite"}, {"@type": "Product", "name": "Array Product", "offers": {"price": "9.99"}}]
        </script>
      </head><body></body></html>
    `)

    const result = await extractProductFromUrl('https://example.com/array')
    expect(result.name).toBe('Array Product')
  })

  it('handles invalid JSON-LD gracefully', async () => {
    mockFetch(`
      <html><head>
        <script type="application/ld+json">not valid json</script>
        <title>Fallback Title</title>
      </head><body></body></html>
    `)

    const result = await extractProductFromUrl('https://example.com/invalid')
    expect(result.name).toBe('Fallback Title')
  })
})
