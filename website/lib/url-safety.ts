import dns from 'dns/promises'

/**
 * Check if an IP address string is private/internal.
 */
function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1' || ip === '::') return true

  // IPv4
  const parts = ip.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const octets = parts.map(Number)
    const [a, b] = octets
    if (a === 127) return true             // loopback
    if (a === 10) return true              // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 169 && b === 254) return true // link-local
    if (a === 0) return true               // 0.0.0.0/8
  }

  return false
}

/**
 * SSRF protection: checks if a URL points to a private/internal network.
 * Blocks localhost, private IPs, link-local, and non-HTTP(S) schemes.
 */
export function isPrivateUrl(parsed: URL): boolean {
  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return true
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true
  }

  // Block metadata endpoints (AWS, GCP, Azure)
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return true
  }

  // Check hostname directly if it's an IP
  if (isPrivateIP(hostname)) return true

  return false
}

/**
 * DNS-aware SSRF check: resolves hostname and verifies resolved IPs aren't private.
 * Prevents DNS rebinding attacks.
 */
export async function isPrivateUrlResolved(parsed: URL): Promise<boolean> {
  // Quick check on hostname first
  if (isPrivateUrl(parsed)) return true

  try {
    const addresses = await dns.resolve4(parsed.hostname)
    for (const addr of addresses) {
      if (isPrivateIP(addr)) return true
    }
  } catch {
    // DNS resolution failed — allow (it'll fail on fetch anyway)
  }

  return false
}
