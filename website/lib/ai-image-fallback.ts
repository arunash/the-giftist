import Anthropic from '@anthropic-ai/sdk'
import { findProductImage } from './product-image'
import { verifyImageMatch } from './verify-image'
import { logApiCall } from './api-logger'

const anthropic = new Anthropic()

/**
 * AI-powered image fallback (Layer 3).
 *
 * When scraping and search engines fail, uses Claude Haiku to:
 * 1. Understand the product and generate optimized search queries
 * 2. Retry image search with those queries
 * 3. If still nothing, return a generated product card image URL
 */
export async function aiImageFallback(productName: string, baseUrl: string): Promise<string | null> {
  // Step 1: Ask Claude to generate better search terms
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You help find product images. Given a product name, return a JSON object with:
- "brand": the brand name (or "")
- "model": the specific model/variant (or "")
- "category": product category (e.g. "mug", "headphones", "backpack")
- "emoji": single emoji that best represents this product
- "queries": array of 3 alternative search queries that would find this exact product image on Bing/Google (be specific — include brand, color, model number)
Return ONLY the JSON, no markdown.`,
      messages: [{
        role: 'user',
        content: productName,
      }],
    })

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      source: 'AI_IMAGE_FALLBACK',
    }).catch(() => {})

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    let parsed: { brand?: string; model?: string; category?: string; emoji?: string; queries?: string[] }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      parsed = {}
    }

    // Step 2: Try each alternative search query, verify match
    if (parsed.queries?.length) {
      for (const query of parsed.queries) {
        try {
          const image = await findProductImage(query)
          if (image) {
            const matches = await verifyImageMatch(image, productName)
            if (matches) {
              console.log(`[ai-image] Verified image for "${productName}" via query: "${query}"`)
              return image
            }
            console.log(`[ai-image] Image mismatch for "${productName}" via query: "${query}"`)
          }
        } catch {}
      }
    }

    // Step 3: If all searches fail, return a generated product card image
    // Uses a dynamic API route that renders an image with product info
    const params = new URLSearchParams({
      name: productName,
      emoji: parsed.emoji || '🎁',
      category: parsed.category || '',
      brand: parsed.brand || '',
    })
    const generatedUrl = `${baseUrl}/api/product-image?${params.toString()}`
    console.log(`[ai-image] All searches failed for "${productName}", using generated card`)
    return generatedUrl

  } catch (err) {
    console.error('[ai-image] AI fallback failed:', err)
    return null
  }
}
