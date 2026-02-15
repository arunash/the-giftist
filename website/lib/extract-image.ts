import OpenAI from 'openai'

export interface ImageProductInfo {
  name: string
  price: string | null
  priceValue: number | null
  brand: string | null
  description: string | null
}

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI()
  return _client
}

export async function extractProductFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  caption?: string,
): Promise<ImageProductInfo | null> {
  const base64 = imageBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const response = await getClient().chat.completions.create({
    model: 'gpt-5.2',
    max_completion_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl },
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

  const text = response.choices[0]?.message?.content || ''
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
