import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './db'
import { normalizePhone } from './whatsapp'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA4d084fd13308242b810892d8bf45f4a0'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
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
        }

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
      // When signing in with Google, check if there's already a user with that email
      // (e.g. a phone-first user who later added email, or whose email was set via profile)
      // If so, link the Google account to the existing user instead of creating a duplicate
      if (account?.provider === 'google' && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: { where: { provider: 'google' } } },
        })

        if (existing && existing.accounts.length === 0) {
          // Existing user has this email but no Google account linked — link it
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
          // Update name/image from Google if not already set
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: existing.name || user.name,
              image: existing.image || user.image,
            },
          })
          // Override the user object so NextAuth uses the existing user's ID
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
      // On subsequent requests, look up phone from DB if not set
      if (token.id && !token.phone) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { phone: true },
        })
        if (dbUser?.phone) {
          token.phone = dbUser.phone
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).phone = token.phone || null
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
