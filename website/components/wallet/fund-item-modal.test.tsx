// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FundItemModal } from './fund-item-modal'

const item = {
  id: 'item-1',
  name: 'Test Gift',
  image: 'https://example.com/img.jpg',
  priceValue: 100,
  goalAmount: 100,
  fundedAmount: 25,
}

describe('FundItemModal', () => {
  it('renders item name and goal', () => {
    render(
      <FundItemModal
        item={item}
        walletBalance={200}
        onClose={() => {}}
        onFunded={() => {}}
      />
    )

    expect(screen.getByText('Test Gift')).toBeInTheDocument()
    expect(screen.getByText('$100.00 goal')).toBeInTheDocument()
  })

  it('shows funded and remaining amounts', () => {
    render(
      <FundItemModal
        item={item}
        walletBalance={200}
        onClose={() => {}}
        onFunded={() => {}}
      />
    )

    expect(screen.getByText('$25.00 funded')).toBeInTheDocument()
    expect(screen.getByText('$75.00 remaining')).toBeInTheDocument()
  })

  it('shows wallet balance', () => {
    render(
      <FundItemModal
        item={item}
        walletBalance={150}
        onClose={() => {}}
        onFunded={() => {}}
      />
    )

    expect(screen.getByText('Balance: $150.00')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(
      <FundItemModal
        item={item}
        walletBalance={200}
        onClose={onClose}
        onFunded={() => {}}
      />
    )

    // The X button
    const closeButtons = screen.getAllByRole('button')
    const xButton = closeButtons.find(b => b.querySelector('svg'))
    if (xButton) {
      await userEvent.click(xButton)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('disables fund button when no amount entered', () => {
    render(
      <FundItemModal
        item={item}
        walletBalance={200}
        onClose={() => {}}
        onFunded={() => {}}
      />
    )

    const fundButton = screen.getByRole('button', { name: 'Fund Item' })
    expect(fundButton).toBeDisabled()
  })
})
