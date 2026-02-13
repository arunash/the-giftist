import Anthropic from '@anthropic-ai/sdk'

export interface ImageProductInfo {
  name: string
  price: string | null
  priceValue: number | null
  brand: string | null
  description: string | null
}

const client = new Anthropic()

export async function extractProductFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  caption?: string,
): Promise<ImageProductInfo | null> {
  const base64 = imageBuffer.toString('base64')
  const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Identify the product in this image. ${caption ? `Context: "${caption}"` : ''}

Return ONLY a JSON object with these fields:
- name: product name (string, required)
- price: formatted price if visible like "$29.99" (string or null)
- priceValue: numeric price if visible (number or null)
- brand: brand name if identifiable (string or null)
- description: one-line description (string or null)

If this is not a product image, return {"name": null}.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.name) return null
    return {
      name: parsed.name,
      price: parsed.price || null,
      priceValue: parsed.priceValue || null,
      brand: parsed.brand || null,
      description: parsed.description || null,
    }
  } catch {
    return null
  }
}
