import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AppShell } from '@/components/layout/app-shell'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id

  const [wallet, user] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { lifetimeContributionsReceived: true, quizCompletedAt: true },
    }),
  ])

  // Quiz-first gate: any logged-in user who hasn't completed the gift quiz
  // gets routed through /magic before they can use the in-app chat / feed.
  // /magic preserves the next param so they land where they intended after.
  if (!user?.quizCompletedAt) {
    redirect('/magic?next=/chat')
  }

  return (
    <AppShell
      walletBalance={wallet?.balance ?? 0}
      fundsReceived={user?.lifetimeContributionsReceived ?? 0}
    >
      {children}
    </AppShell>
  )
}
