// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestionChip } from './suggestion-chip'

describe('SuggestionChip', () => {
  it('renders label text', () => {
    render(<SuggestionChip label="Gift ideas" onClick={() => {}} />)
    expect(screen.getByText('Gift ideas')).toBeInTheDocument()
  })

  it('calls onClick with label when clicked', async () => {
    const onClick = vi.fn()
    render(<SuggestionChip label="Gift ideas" onClick={onClick} />)

    await userEvent.click(screen.getByText('Gift ideas'))
    expect(onClick).toHaveBeenCalledWith('Gift ideas')
  })

  it('renders as a button', () => {
    render(<SuggestionChip label="Test" onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
