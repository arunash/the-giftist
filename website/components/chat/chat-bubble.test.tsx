// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatBubble } from './chat-bubble'

describe('ChatBubble', () => {
  it('renders user message content', () => {
    render(<ChatBubble role="USER" content="Hello there" />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    render(<ChatBubble role="ASSISTANT" content="How can I help?" />)
    expect(screen.getByText('How can I help?')).toBeInTheDocument()
  })

  it('applies user styling (right-aligned)', () => {
    const { container } = render(<ChatBubble role="USER" content="Hi" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('justify-end')
  })

  it('applies assistant styling (left-aligned)', () => {
    const { container } = render(<ChatBubble role="ASSISTANT" content="Hi" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('justify-start')
  })
})
