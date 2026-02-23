import Anthropic from '@anthropic-ai/sdk'
import { logApiCall } from '@/lib/api-logger'

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

  const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

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
            text: `Identify the EXACT product in this image. ${caption ? `Context: "${caption}"` : ''}

Your goal is to return the specific brand, product line, and model name — NOT a generic description.

IMPORTANT RULES:
- Look for visible text: brand logos, product names, model numbers, packaging text
- Be as specific as possible. "Lamaze Freddie the Firefly" NOT "baby activity toy"
- Include model numbers when visible (e.g. "Sony WH-1000XM5" not "wireless headphones")
- If you recognize the product but can't see text, use your knowledge to name it precisely
- The name should be searchable on Amazon/Target/Walmart and return the exact product

Return ONLY a JSON object with these fields:
- name: specific product name as it would appear on a retailer listing (string, required)
- price: formatted price if visible like "$29.99" (string or null)
- priceValue: numeric price if visible (number or null)
- brand: brand/manufacturer name (string or null)
- description: one-line description for search context (string or null)

If this is not a product image, return {"name": null}.`,
          },
        ],
      },
    ],
  })

  logApiCall({
    provider: 'ANTHROPIC',
    endpoint: '/messages',
    model: 'claude-sonnet-4-5-20250929',
    inputTokens: response.usage?.input_tokens || null,
    outputTokens: response.usage?.output_tokens || null,
    source: 'WHATSAPP',
  }).catch(() => {})

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

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
