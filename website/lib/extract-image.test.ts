import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use a module-level holder to avoid hoisting issues
const mocks = { create: vi.fn() }

vi.mock('openai', () => ({
  default: function OpenAI() {
    return { chat: { completions: { create: (...args: any[]) => mocks.create(...args) } } }
  },
}))

import { extractProductFromImage } from './extract-image'

beforeEach(() => {
  mocks.create.mockResolvedValue({
    choices: [{
      message: {
        content: '{"name": "Nike Air Max", "price": "$129.99", "priceValue": 129.99, "brand": "Nike", "description": "Running shoes"}',
      },
    }],
  })
})

describe('extractProductFromImage', () => {
  it('extracts product info from image', async () => {
    const result = await extractProductFromImage(
      Buffer.from('fake-image'),
      'image/jpeg'
    )

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Nike Air Max')
    expect(result!.price).toBe('$129.99')
    expect(result!.priceValue).toBe(129.99)
    expect(result!.brand).toBe('Nike')
  })

  it('passes caption to OpenAI', async () => {
    await extractProductFromImage(
      Buffer.from('fake-image'),
      'image/jpeg',
      'Christmas gift idea'
    )

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('Christmas gift idea'),
              }),
            ]),
          }),
        ]),
      })
    )
  })

  it('returns null when model returns name: null', async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: '{"name": null}' } }],
    })

    const result = await extractProductFromImage(Buffer.from('x'), 'image/jpeg')
    expect(result).toBeNull()
  })

  it('returns null for invalid JSON response', async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: 'Sorry, I cannot identify this image.' } }],
    })

    const result = await extractProductFromImage(Buffer.from('x'), 'image/jpeg')
    expect(result).toBeNull()
  })

  it('handles missing optional fields', async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: '{"name": "Mystery Item"}' } }],
    })

    const result = await extractProductFromImage(Buffer.from('x'), 'image/jpeg')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Mystery Item')
    expect(result!.price).toBeNull()
    expect(result!.brand).toBeNull()
  })
})
