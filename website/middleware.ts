import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = new Set([
  'https://giftist.ai',
  'https://www.giftist.ai',
  'https://admin.giftist.ai',
])

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // CSRF protection: validate Origin header on state-changing API requests
  const method = request.method
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    !pathname.startsWith('/api/webhooks/') &&
    !pathname.startsWith('/api/cron/') &&
    (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')
  ) {
    const origin = request.headers.get('origin')
    // Allow requests with no origin (non-browser clients, e.g. curl, mobile apps)
    // Allow Bearer token requests (authenticated API clients)
    const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')
    if (origin && !hasBearer) {
      const isLocalDev = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
      if (!ALLOWED_ORIGINS.has(origin) && !isLocalDev) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  // admin.giftist.ai — rewrite all requests to /admin/* internally
  if (hostname.startsWith('admin.')) {
    // Root of admin subdomain → /admin
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.rewrite(url)
    }
    // /users → /admin/users, /errors → /admin/errors, etc.
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/') && !pathname.startsWith('/_next') && !pathname.startsWith('/favicon')) {
      const url = request.nextUrl.clone()
      url.pathname = `/admin${pathname}`
      return NextResponse.rewrite(url)
    }
  }

  // Allow /admin routes on main domain too (admin pages check isAdmin in session)
  // Previously blocked to require admin. subdomain, but cookies don't share on Vercel

  // Bearer token → cookie injection for Chrome extension
  // Only allow on API routes to limit attack surface
  const authHeader = request.headers.get('authorization')
  if (
    authHeader?.startsWith('Bearer ') &&
    pathname.startsWith('/api/') &&
    !request.cookies.get('next-auth.session-token')?.value
  ) {
    const token = authHeader.slice(7)
    // Reject tokens that look malicious (must be a JWT-shaped string)
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
      return NextResponse.next()
    }
    const requestHeaders = new Headers(request.headers)
    const existingCookies = requestHeaders.get('cookie') || ''
    const separator = existingCookies ? '; ' : ''
    requestHeaders.set(
      'cookie',
      `${existingCookies}${separator}next-auth.session-token=${token}`
    )

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
