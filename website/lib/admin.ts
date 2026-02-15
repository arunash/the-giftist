import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

const ADMIN_PHONES = ['13034087839']

export function isAdmin(session: any): boolean {
  return session?.user?.isAdmin === true
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session)) return null
  return session
}

export { ADMIN_PHONES }
