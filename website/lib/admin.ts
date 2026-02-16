import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

const ADMIN_PHONES = (process.env.ADMIN_PHONES || '').split(',').filter(Boolean)

export function isAdmin(session: any): boolean {
  return session?.user?.isAdmin === true
}

/**
 * Require admin session. Returns session or a 403 NextResponse.
 * Callers must check: `if (admin instanceof NextResponse) return admin`
 */
export async function requireAdmin(): Promise<any | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session
}

export { ADMIN_PHONES }
