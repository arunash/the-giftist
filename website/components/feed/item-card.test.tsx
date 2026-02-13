// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ItemCard } from './item-card'

const baseItem = {
  id: 'item-1',
  name: 'Test Item',
  price: '$25.00',
  priceValue: 25,
  image: 'https://example.com/img.jpg',
  url: 'https://example.com/product',
  domain: 'example.com',
  category: 'Electronics',
  source: 'MANUAL',
  fundedAmount: 0,
  goalAmount: 25,
  isPurchased: false,
}

describe('ItemCard', () => {
  it('renders item name', () => {
    render(<ItemCard item={baseItem} />)
    expect(screen.getByText('Test Item')).toBeInTheDocument()
  })

  it('renders domain', () => {
    render(<ItemCard item={baseItem} />)
    expect(screen.getByText('example.com')).toBeInTheDocument()
  })

  it('renders price pill', () => {
    render(<ItemCard item={baseItem} />)
    expect(screen.getByText('$25.00')).toBeInTheDocument()
  })

  it('renders purchased badge', () => {
    render(<ItemCard item={{ ...baseItem, isPurchased: true }} />)
    expect(screen.getByText('Purchased')).toBeInTheDocument()
  })

  it('does not render purchased badge when not purchased', () => {
    render(<ItemCard item={baseItem} />)
    expect(screen.queryByText('Purchased')).not.toBeInTheDocument()
  })

  it('renders as a link to product URL', () => {
    render(<ItemCard item={baseItem} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com/product')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders image when provided', () => {
    render(<ItemCard item={baseItem} />)
    const img = screen.getByAltText('Test Item')
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg')
  })
})
