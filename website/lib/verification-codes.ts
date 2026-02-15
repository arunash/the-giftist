interface VerificationEntry {
  code: string
  phone: string
  expiresAt: number
  attempts: number
  createdAt: number
  sendCount: number
}

const codes = new Map<string, VerificationEntry>()

const CODE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const RATE_LIMIT_MS = 60 * 1000 // 60 seconds between requests
const MAX_ATTEMPTS = 3
const MAX_SENDS = 3 // initial send + 2 resends

export function generateCode(phone: string): { code?: string; error?: string } {
  const existing = codes.get(phone)

  if (existing && Date.now() < existing.expiresAt) {
    // Rate limit: 60 seconds between sends
    if (Date.now() - existing.createdAt < RATE_LIMIT_MS) {
      return { error: 'Please wait 60 seconds before requesting a new code' }
    }

    // Max sends in the 5-minute window
    if (existing.sendCount >= MAX_SENDS) {
      return { error: 'Too many code requests. Please wait 5 minutes before trying again.' }
    }

    // Resend: generate new code, increment send count
    const code = String(Math.floor(100000 + Math.random() * 900000))
    codes.set(phone, {
      code,
      phone,
      expiresAt: existing.expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      sendCount: existing.sendCount + 1,
    })
    return { code }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))

  codes.set(phone, {
    code,
    phone,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    createdAt: Date.now(),
    sendCount: 1,
  })

  return { code }
}

export function verifyCode(phone: string, code: string): boolean {
  const entry = codes.get(phone)

  if (!entry) return false
  if (Date.now() > entry.expiresAt) {
    codes.delete(phone)
    return false
  }

  entry.attempts++

  if (entry.attempts > MAX_ATTEMPTS) {
    codes.delete(phone)
    return false
  }

  if (entry.code === code) {
    codes.delete(phone)
    return true
  }

  return false
}

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [phone, entry] of codes) {
    if (now > entry.expiresAt) {
      codes.delete(phone)
    }
  }
}, 60 * 1000)
