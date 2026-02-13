import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './db'
import { normalizePhone } from './whatsapp'
import { verifyCode } from './verification-codes'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
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

        if (!verifyCode(normalized, credentials.code)) {
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
  },
  callbacks: {
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
