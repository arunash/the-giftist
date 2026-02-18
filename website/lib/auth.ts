import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './db'
import { normalizePhone } from './whatsapp'
import { createDefaultEventsForUser } from './default-events'
import twilio from 'twilio'
import crypto from 'crypto'
import { ADMIN_PHONES } from './admin'
import { logApiCall } from './api-logger'

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

// Wrap PrismaAdapter to intercept createUser for account linking
const baseAdapter = PrismaAdapter(prisma) as any
const adapter = {
  ...baseAdapter,
  createUser: async (user: any) => {
    // Check if any user has a pending linking token (set by /api/account/prepare-link)
    // Token format: "link_{userId}_{timestamp}_{hmac}"
    try {
      const linkingUser = await prisma.user.findFirst({
        where: {
          linkingToken: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
      })

      if (linkingUser && linkingUser.linkingToken) {
        const parts = linkingUser.linkingToken.split('_')
        // Validate format: link_{userId}_{timestamp}_{hmac}
        if (parts.length === 4 && parts[0] === 'link') {
          const [, tokenUserId, timestampStr, tokenHmac] = parts
          const timestamp = parseInt(timestampStr, 10)
          const secret = process.env.NEXTAUTH_SECRET || ''

          // Verify HMAC
          const expectedHmac = crypto
            .createHmac('sha256', secret)
            .update(`link_${tokenUserId}_${timestampStr}`)
            .digest('hex')
            .slice(0, 16)

          let isValidHmac = false
          try {
            isValidHmac = crypto.timingSafeEqual(Buffer.from(tokenHmac), Buffer.from(expectedHmac))
          } catch {
            isValidHmac = false
          }
          const isRecent = Date.now() - timestamp < 5 * 60 * 1000
          const isCorrectUser = tokenUserId === linkingUser.id

          if (isValidHmac && isRecent && isCorrectUser) {
            // Return existing user instead of creating a new one
            const updated = await prisma.user.update({
              where: { id: linkingUser.id },
              data: {
                email: linkingUser.email || user.email,
                name: linkingUser.name || user.name,
                image: linkingUser.image || user.image,
                linkingToken: null,
              },
            })
            return updated
          }
        }
        // Invalid/expired — clear it
        await prisma.user.update({
          where: { id: linkingUser.id },
          data: { linkingToken: null },
        })
      }
    } catch (e) {
      console.error('[Auth] createUser linking check failed:', e)
    }
    const created = await baseAdapter.createUser(user)
    // Fire-and-forget: create default events for new user
    createDefaultEventsForUser(created.id).catch(() => {})
    return created
  },
}

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      id: 'phone',
      name: 'Phone',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        code: { label: 'Verification Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) {
          return null
        }

        const normalized = normalizePhone(credentials.phone)

        // Verify code via Twilio Verify
        try {
          const check = await twilioClient.verify.v2
            .services(VERIFY_SERVICE_SID)
            .verificationChecks.create({
              to: `+${normalized}`,
              code: credentials.code,
            })

          logApiCall({ provider: 'TWILIO', endpoint: 'verify/check', source: 'AUTH' }).catch(() => {})

          if (check.status !== 'approved') {
            return null
          }
        } catch {
          return null
        }

        let user = await prisma.user.findUnique({
          where: { phone: normalized },
        })

        if (!user) {
          user = await prisma.user.create({
            data: {
              phone: normalized,
              name: `User ${normalized.slice(-4)}`,
            },
          })
          // Fire-and-forget: create default events for new user
          createDefaultEventsForUser(user.id).catch(() => {})
        }

        if (!user.isActive) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 90 * 24 * 60 * 60, // 90 days
  },
  callbacks: {
    async signIn({ user, account }) {
      // Block suspended accounts from signing in
      if (user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isActive: true },
        })
        if (dbUser && !dbUser.isActive) return false
      }

      if (account?.provider === 'google' && user.email) {
        // Normal Google sign-in (not linking): check if a user already exists with this email
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: { where: { provider: 'google' } } },
        })

        if (existing && existing.accounts.length === 0) {
          // User has this email but no Google account — link it
          await prisma.account.create({
            data: {
              userId: existing.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token ?? undefined,
              refresh_token: account.refresh_token ?? undefined,
              expires_at: account.expires_at ?? undefined,
              token_type: account.token_type ?? undefined,
              scope: account.scope ?? undefined,
              id_token: account.id_token ?? undefined,
            },
          })
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: existing.name || user.name,
              image: existing.image || user.image,
            },
          })
          user.id = existing.id
          return true
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.phone = (user as any).phone || null
      }
      // On subsequent requests, look up phone and active status from DB
      if (token.id && !token.phone) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { phone: true, isActive: true },
        })
        if (dbUser?.phone) {
          token.phone = dbUser.phone
        }
        // Invalidate session for suspended users
        if (dbUser && !dbUser.isActive) {
          return { ...token, isActive: false }
        }
      }
      // Admin check
      token.isAdmin = !!(token.phone && ADMIN_PHONES.includes(token.phone as string))
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).phone = token.phone || null
        ;(session.user as any).isAdmin = token.isAdmin || false
        if (token.isActive === false) {
          // Return empty session for suspended users
          return { ...session, user: undefined }
        }
      }
      return session
    },
  },
  cookies: (() => {
    const isLocalDev = process.env.NODE_ENV === 'development'
    return {
      sessionToken: {
        name: 'next-auth.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: !isLocalDev,
          domain: isLocalDev ? undefined : (process.env.VERCEL ? undefined : '.giftist.ai'),
        },
      },
      csrfToken: {
        name: 'next-auth.csrf-token',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: !isLocalDev,
        },
      },
      callbackUrl: {
        name: 'next-auth.callback-url',
        options: {
          httpOnly: true,
          sameSite: 'lax' as const,
          path: '/',
          secure: !isLocalDev,
        },
      },
    }
  })(),
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
