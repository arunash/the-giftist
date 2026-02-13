import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  // If request has a Bearer token but no session cookie, inject the token as a cookie
  // so NextAuth's getServerSession() picks it up. Used by the Chrome extension.
  if (
    authHeader?.startsWith('Bearer ') &&
    !request.cookies.get('next-auth.session-token')?.value
  ) {
    const token = authHeader.slice(7)
    const requestHeaders = new Headers(request.headers)
    // Append the session cookie to the existing cookie header
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
  matcher: '/api/:path*',
}
