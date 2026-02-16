import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

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
  const authHeader = request.headers.get('authorization')
  if (
    authHeader?.startsWith('Bearer ') &&
    !request.cookies.get('next-auth.session-token')?.value
  ) {
    const token = authHeader.slice(7)
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
