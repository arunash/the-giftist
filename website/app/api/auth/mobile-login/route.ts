import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizePhone } from '@/lib/whatsapp'
import { createDefaultEventsForUser } from '@/lib/default-events'
import { notifyWelcome } from '@/lib/notifications'
import { logApiCall, logError } from '@/lib/api-logger'
import { ADMIN_PHONES } from '@/lib/admin'
import twilio from 'twilio'
import { encode } from 'next-auth/jwt'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`${name} environment variable is required`)
  return val
}

const VERIFY_SERVICE_SID = requireEnv('TWILIO_VERIFY_SERVICE_SID')

async function createJwt(user: { id: string; phone?: string | null; email?: string | null; name?: string | null }) {
  const isAdmin = !!(user.phone && ADMIN_PHONES.includes(user.phone))
  const token = await encode({
    token: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET || '',
    maxAge: 30 * 24 * 60 * 60,
  })
  return token
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, code, googleIdToken, appleIdToken } = body

    // ── Phone OTP login ──
    if (phone && code) {
      const normalized = normalizePhone(phone)
      if (normalized.length < 10) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
      }

      const check = await twilioClient.verify.v2
        .services(VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: `+${normalized}`, code })

      logApiCall({ provider: 'TWILIO', endpoint: 'verify/check', source: 'MOBILE_AUTH' }).catch(() => {})

      if (check.status !== 'approved') {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 })
      }

      let user = await prisma.user.findUnique({ where: { phone: normalized } })
      let isNew = false

      if (!user) {
        user = await prisma.user.create({
          data: { phone: normalized, name: `User ${normalized.slice(-4)}` },
        })
        isNew = true
        createDefaultEventsForUser(user.id).catch(() => {})
        notifyWelcome(user.id, user.email, user.phone, user.name).catch(() => {})
      }

      if (!user.isActive) {
        return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
      }

      const jwt = await createJwt(user)
      return NextResponse.json({
        token: jwt,
        user: { id: user.id, name: user.name, phone: user.phone, email: user.email, image: user.image },
        isNew,
      })
    }

    // ── Google ID token login ──
    if (googleIdToken) {
      // Verify the Google ID token
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${googleIdToken}`)
      if (!res.ok) {
        return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 })
      }
      const payload = await res.json()
      const { email, name, picture, sub: googleId } = payload

      if (!email) {
        return NextResponse.json({ error: 'No email in Google token' }, { status: 400 })
      }

      // Verify audience matches our client ID
      if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        return NextResponse.json({ error: 'Token audience mismatch' }, { status: 401 })
      }

      // Find or create user
      let user = await prisma.user.findUnique({ where: { email } })
      let isNew = false

      if (!user) {
        user = await prisma.user.create({
          data: { email, name, image: picture },
        })
        isNew = true
        createDefaultEventsForUser(user.id).catch(() => {})
        notifyWelcome(user.id, user.email, user.phone, user.name).catch(() => {})
      }

      // Ensure Google account is linked
      const existingAccount = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleId } },
      })
      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: 'google',
            providerAccountId: googleId,
          },
        })
      }

      if (!user.isActive) {
        return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
      }

      const jwt = await createJwt(user)
      return NextResponse.json({
        token: jwt,
        user: { id: user.id, name: user.name, phone: user.phone, email: user.email, image: user.image },
        isNew,
      })
    }

    // ── Apple ID token login ──
    if (appleIdToken) {
      // Verify Apple ID token via JWKS
      const appleKeys = await fetch('https://appleid.apple.com/auth/keys').then(r => r.json())
      // Decode JWT header to get kid
      const [headerB64] = appleIdToken.split('.')
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString())
      const key = appleKeys.keys.find((k: any) => k.kid === header.kid)

      if (!key) {
        return NextResponse.json({ error: 'Invalid Apple token' }, { status: 401 })
      }

      // Import the JWK and verify
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        key,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      )

      const [, payloadB64, signatureB64] = appleIdToken.split('.')
      const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
      const signature = Buffer.from(signatureB64, 'base64url')
      const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data)

      if (!valid) {
        return NextResponse.json({ error: 'Invalid Apple token signature' }, { status: 401 })
      }

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
      const { sub: appleId, email: appleEmail } = payload

      // Apple may not always provide email after first sign-in
      // Also accept email from request body (Apple sends it separately on first auth)
      const email = appleEmail || body.email
      const fullName = body.fullName // { givenName, familyName } from Apple

      let user: any = null
      let isNew = false

      // Try to find by Apple account first
      const existingAccount = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: 'apple', providerAccountId: appleId } },
        include: { user: true },
      })

      if (existingAccount) {
        user = existingAccount.user
      } else if (email) {
        user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          const name = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : undefined
          user = await prisma.user.create({
            data: { email, name: name || undefined },
          })
          isNew = true
          createDefaultEventsForUser(user.id).catch(() => {})
          notifyWelcome(user.id, user.email, user.phone, user.name).catch(() => {})
        }
        // Link Apple account
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: 'apple',
            providerAccountId: appleId,
          },
        })
      } else {
        return NextResponse.json({ error: 'No email available from Apple' }, { status: 400 })
      }

      if (!user.isActive) {
        return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
      }

      const jwt = await createJwt(user)
      return NextResponse.json({
        token: jwt,
        user: { id: user.id, name: user.name, phone: user.phone, email: user.email, image: user.image },
        isNew,
      })
    }

    return NextResponse.json({ error: 'Provide phone+code, googleIdToken, or appleIdToken' }, { status: 400 })
  } catch (error: any) {
    console.error('[mobile-login] Error:', error)
    logError({ source: 'MOBILE_AUTH', message: String(error), stack: error?.stack }).catch(() => {})
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
