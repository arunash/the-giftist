import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

const ADMIN_PHONES = (process.env.ADMIN_PHONES || '').split(',').filter(Boolean)

export function isAdmin(session: any): boolean {
  return session?.user?.isAdmin === true
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session)) return null
  return session
}

export { ADMIN_PHONES }
