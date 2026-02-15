import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()
  if (!session) {
    redirect('/feed')
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
