// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">icon</span>}
        title="No items yet"
        description="Add your first item to get started"
      />
    )

    expect(screen.getByText('No items yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first item to get started')).toBeInTheDocument()
  })

  it('renders icon', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">icon</span>}
        title="Empty"
        description="Nothing here"
      />
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders action when provided', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Empty"
        description="Nothing here"
        action={<button>Add Item</button>}
      />
    )
    expect(screen.getByText('Add Item')).toBeInTheDocument()
  })
})
