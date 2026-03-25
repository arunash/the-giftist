import JSZip from 'jszip'

/**
 * Extract WhatsApp chat text from a .txt or .zip file buffer.
 * WhatsApp iOS exports produce a .zip containing _chat.txt.
 * Returns the raw text content, or null if no valid chat file found.
 */
export async function extractChatText(
  buffer: Buffer,
  mimeType: string,
  filename?: string,
): Promise<string | null> {
  const isZip =
    mimeType === 'application/zip' ||
    mimeType === 'application/x-zip-compressed' ||
    mimeType === 'application/octet-stream' && filename?.endsWith('.zip') ||
    filename?.endsWith('.zip')

  const isText =
    mimeType === 'text/plain' ||
    mimeType === 'application/octet-stream' && filename?.endsWith('.txt') ||
    filename?.endsWith('.txt')

  if (isText) {
    return buffer.toString('utf-8')
  }

  if (isZip) {
    try {
      const zip = await JSZip.loadAsync(buffer)
      // Look for .txt files inside the zip
      const txtFiles = Object.keys(zip.files).filter(
        (name) => name.endsWith('.txt') && !name.startsWith('__MACOSX'),
      )

      if (txtFiles.length === 0) {
        return null
      }

      // Prefer _chat.txt (WhatsApp iOS naming) or the largest .txt file
      const chatFile =
        txtFiles.find((f) => f.includes('_chat.txt') || f.includes('WhatsApp Chat')) ||
        txtFiles[0]

      const content = await zip.files[chatFile].async('string')
      return content
    } catch {
      return null
    }
  }

  return null
}

/**
 * Check if a file is a supported chat export format.
 */
export function isSupportedChatFile(mimeType: string, filename?: string): boolean {
  if (mimeType === 'text/plain') return true
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return true
  if (filename?.endsWith('.txt') || filename?.endsWith('.zip')) return true
  if (mimeType === 'application/octet-stream' && (filename?.endsWith('.txt') || filename?.endsWith('.zip'))) return true
  return false
}
