import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import LinkPhoneForm from './link-phone-form'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, shareId: true },
  })

  const shareUrl = `https://giftist.ai/share/${user?.shareId}`

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-secondary">Settings</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {/* Name */}
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
            <p className="text-secondary font-medium">{user?.name || 'Not set'}</p>
          </div>

          {/* Email */}
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
            {user?.email ? (
              <p className="text-secondary font-medium">{user.email}</p>
            ) : (
              <div>
                <p className="text-gray-400 mb-3">No email linked</p>
                <a
                  href="/api/auth/signin/google?callbackUrl=/settings"
                  className="inline-flex items-center gap-2 bg-white border-2 border-gray-200 rounded-lg py-2 px-4 font-medium text-secondary hover:bg-gray-50 transition text-sm"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Link Google Account
                </a>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-500 mb-1">Phone (WhatsApp)</label>
            {user?.phone ? (
              <p className="text-secondary font-medium">+{user.phone}</p>
            ) : (
              <div>
                <p className="text-gray-400 mb-3">No phone linked</p>
                <LinkPhoneForm />
              </div>
            )}
          </div>
        </div>

        {/* Share Link */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-secondary mb-2">Share Your Giftist</h2>
          <p className="text-sm text-gray-500 mb-3">Send this link to friends and family</p>
          <div className="p-3 bg-gray-50 rounded-lg">
            <code className="text-sm text-gray-600 break-all">{shareUrl}</code>
          </div>
        </div>
      </div>
    </div>
  )
}
