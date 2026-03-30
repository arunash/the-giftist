import Anthropic from '@anthropic-ai/sdk'
import { logApiCall } from './api-logger'

const client = new Anthropic()

/**
 * Verify that an image URL actually depicts the named product.
 * Uses Claude Haiku vision — fast and cheap (~0.1¢ per check).
 * Returns true if the image is a reasonable match, false if it's
 * clearly wrong (logo, banner, unrelated product, placeholder).
 */
export async function verifyImageMatch(
  imageUrl: string,
  productName: string,
): Promise<boolean> {
  try {
    // Quick pre-checks: skip obvious non-product images
    const lower = imageUrl.toLowerCase()
    if (/logo|favicon|icon|sprite|badge|banner|placeholder|spacer|pixel/i.test(lower)) {
      return false
    }

    // Fetch image and check size (skip tiny images < 5KB)
    const imgRes = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!imgRes.ok) return false

    const contentType = imgRes.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return false

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    if (buffer.length < 3000) return false // too small, likely a pixel/icon

    const mediaType = contentType.split(';')[0].trim() as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
          },
          {
            type: 'text',
            text: `Does this image show "${productName}" or a very similar product? Reply ONLY "yes" or "no".`,
          },
        ],
      }],
    })

    logApiCall({
      provider: 'ANTHROPIC',
      endpoint: '/messages',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      source: 'IMAGE_VERIFY',
    }).catch(() => {})

    const answer = response.content[0].type === 'text' ? response.content[0].text.toLowerCase().trim() : ''
    return answer.startsWith('yes')
  } catch (err) {
    console.error(`[verify-image] Failed for "${productName}":`, err)
    // On error, allow the image through (don't block on verification failure)
    return true
  }
}
